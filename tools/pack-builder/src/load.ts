import {
  packManifestSchema,
  parseLessonMarkdown,
  questionFileSchema,
  type Block,
  type PackManifest,
  type Question,
} from "@pragya/content";
import {
  BUNDLE_FORMAT_VERSION,
  signBundle,
  type BundledLesson,
  type PackBundle,
} from "./bundle.js";
import { openPackFiles, type PackFiles } from "./pack-files.js";

export { verifyChecksum } from "./bundle.js";

export type LoadResult =
  | { readonly ok: true; readonly bundle: PackBundle }
  | { readonly ok: false; readonly errors: readonly string[] };

const MANIFEST = "manifest.json";

type Parsed<T> = { readonly value?: T; readonly errors: readonly string[] };

const issues = (
  file: string,
  error: { issues: readonly { path: PropertyKey[]; message: string }[] },
) => error.issues.map((i) => `${file}: ${i.path.map(String).join(".") || "(root)"} ${i.message}`);

async function readJson(files: PackFiles, path: string): Promise<Parsed<unknown>> {
  const read = await files.read(path);
  if (!read.ok) return { errors: [read.error] };
  try {
    return { value: JSON.parse(read.text) as unknown, errors: [] };
  } catch (error: unknown) {
    return {
      errors: [`${path}: invalid JSON (${error instanceof Error ? error.message : "parse error"})`],
    };
  }
}

async function loadManifest(files: PackFiles): Promise<Parsed<PackManifest>> {
  const json = await readJson(files, MANIFEST);
  if (json.value === undefined) return { errors: json.errors };
  const parsed = packManifestSchema.safeParse(json.value);
  return parsed.success
    ? { value: parsed.data, errors: [] }
    : { errors: issues(MANIFEST, parsed.error) };
}

async function missingFigures(
  files: PackFiles,
  file: string,
  blocks: readonly Block[],
): Promise<string[]> {
  const figures = blocks.flatMap((b) => (b.type === "figure" ? [b.src] : []));
  const present = await Promise.all(figures.map((src) => files.exists(src)));
  return figures.filter((_, i) => !present[i]).map((src) => `${file}: figure "${src}" not found`);
}

async function loadLessons(
  files: PackFiles,
  manifest: PackManifest,
): Promise<Parsed<BundledLesson[]>> {
  const entries = manifest.modules.flatMap((mod) =>
    mod.lessons.map((lesson, index) => ({ ...lesson, moduleId: mod.id, position: index + 1 })),
  );
  const results = await Promise.all(
    entries.map(async (entry): Promise<Parsed<BundledLesson>> => {
      const read = await files.read(entry.file);
      if (!read.ok) return { errors: [read.error] };
      const parsed = parseLessonMarkdown(read.text);
      const parseErrors = parsed.ok ? [] : parsed.errors.map((e) => `${entry.file}: ${e}`);
      const figureErrors = await missingFigures(files, entry.file, parsed.blocks);
      const { file: _file, ...lesson } = entry;
      return {
        value: { ...lesson, blocks: parsed.blocks },
        errors: [...parseErrors, ...figureErrors],
      };
    }),
  );
  return {
    value: results.flatMap((r) => (r.value ? [r.value] : [])),
    errors: results.flatMap((r) => r.errors),
  };
}

async function loadQuestions(
  files: PackFiles,
  manifest: PackManifest,
): Promise<Parsed<Question[]>> {
  const seen = new Set<string>();
  const questions: Question[] = [];
  const errors: string[] = [];
  for (const path of manifest.questionFiles) {
    const json = await readJson(files, path);
    errors.push(...json.errors);
    if (json.value === undefined) continue;
    const parsed = questionFileSchema.safeParse(json.value);
    if (!parsed.success) {
      errors.push(...issues(path, parsed.error));
      continue;
    }
    for (const question of parsed.data) {
      if (seen.has(question.id)) errors.push(`${path}: duplicate question id "${question.id}"`);
      seen.add(question.id);
      questions.push(question);
    }
  }
  return { value: questions, errors };
}

function referenceErrors(
  manifest: PackManifest,
  lessons: readonly BundledLesson[],
  questions: readonly Question[],
): string[] {
  // Use the manifest's ids so a lesson with its own errors doesn't orphan its questions.
  const lessonIds = new Set(manifest.modules.flatMap((m) => m.lessons.map((l) => l.id)));
  const pools = new Set([...lessonIds, ...questions.flatMap((q) => q.tags ?? [])]);
  const fileOf = new Map(
    manifest.modules.flatMap((m) => m.lessons.map((l) => [l.id, l.file] as const)),
  );
  const orphanQuestions = questions
    .filter((q) => !lessonIds.has(q.lessonId))
    .map((q) => `question "${q.id}": unknown lesson "${q.lessonId}"`);
  const unknownPools = lessons.flatMap((lesson) =>
    lesson.blocks
      .filter((b) => b.type === "quiz" && !pools.has(b.poolRef))
      .map(
        (b) =>
          `${fileOf.get(lesson.id)}: quiz pool "${b.type === "quiz" ? b.poolRef : ""}" matches no lesson or question tag`,
      ),
  );
  return [...orphanQuestions, ...unknownPools];
}

/** Loads, validates and bundles a content pack directory, reporting every problem found. */
export async function loadPack(directory: string): Promise<LoadResult> {
  const files = await openPackFiles(directory);
  const manifest = await loadManifest(files);
  if (manifest.value === undefined) return { ok: false, errors: manifest.errors };

  const [lessons, questions] = await Promise.all([
    loadLessons(files, manifest.value),
    loadQuestions(files, manifest.value),
  ]);
  const errors = [
    ...lessons.errors,
    ...questions.errors,
    ...referenceErrors(manifest.value, lessons.value ?? [], questions.value ?? []),
  ];
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    bundle: signBundle({
      formatVersion: BUNDLE_FORMAT_VERSION,
      manifest: manifest.value,
      modules: manifest.value.modules.map((m, i) => ({
        id: m.id,
        title: m.title,
        position: i + 1,
      })),
      lessons: lessons.value ?? [],
      questions: questions.value ?? [],
    }),
  };
}
