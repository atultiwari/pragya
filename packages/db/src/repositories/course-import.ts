import { and, eq, notInArray } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "../client.js";
import { courses, lessons, modules, streams } from "../schema/index.js";

export interface ModuleImport {
  readonly slug: string;
  readonly title: string;
  readonly position: number;
}

export interface LessonImport {
  readonly slug: string;
  readonly moduleSlug: string;
  readonly title: string;
  readonly position: number;
  readonly isPreview: boolean;
  readonly blocks: readonly unknown[];
}

export interface CourseImport {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly streamSlug: string;
  readonly language: string;
  readonly pricePaise: number;
  readonly visibility: "public" | "institute" | "public_and_institute";
  readonly contentVersion: string;
  readonly contentChecksum: string;
  /** Publish now; a course that is already published stays published either way. */
  readonly publish: boolean;
  readonly modules: readonly ModuleImport[];
  readonly lessons: readonly LessonImport[];
}

export interface ImportSummary {
  readonly courseId: string;
  readonly created: boolean;
  readonly modules: number;
  readonly lessons: number;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class CourseImportError extends Error {
  override readonly name = "CourseImportError";
}

function assertConsistent(input: CourseImport): void {
  // Marketplace imports have no owning institute, and the courses CHECK requires one otherwise.
  if (input.visibility !== "public") {
    throw new CourseImportError(
      `visibility "${input.visibility}" needs an owning institute; import as "public"`,
    );
  }
  const moduleSlugs = new Set(input.modules.map((m) => m.slug));
  if (moduleSlugs.size !== input.modules.length)
    throw new CourseImportError("module slugs must be unique");
  const orphan = input.lessons.find((l) => !moduleSlugs.has(l.moduleSlug));
  if (orphan)
    throw new CourseImportError(
      `lesson "${orphan.slug}" refers to unknown module "${orphan.moduleSlug}"`,
    );
}

async function upsertCourse(
  tx: Tx,
  input: CourseImport,
  streamId: string,
): Promise<{ id: string; created: boolean }> {
  const [existing] = await tx
    .select({ id: courses.id, publishedAt: courses.publishedAt, instituteId: courses.instituteId })
    .from(courses)
    .where(eq(courses.slug, input.slug))
    .limit(1);
  const content = {
    streamId,
    title: input.title,
    summary: input.summary,
    language: input.language,
    pricePaise: input.pricePaise,
    visibility: input.visibility,
    contentVersion: input.contentVersion,
    contentChecksum: input.contentChecksum,
  };
  const publishing = input.publish ? { status: "published" as const } : {};
  if (existing?.instituteId) {
    // Marketplace packs must never rewrite (and prune lessons of) an institute's own course.
    throw new CourseImportError(
      `course "${input.slug}" belongs to an institute; choose a different pack id`,
    );
  }
  if (existing) {
    const publishedAt =
      input.publish && existing.publishedAt === null ? { publishedAt: new Date() } : {};
    await tx
      .update(courses)
      .set({ ...content, ...publishing, ...publishedAt })
      .where(eq(courses.id, existing.id));
    return { id: existing.id, created: false };
  }
  const id = ulid();
  await tx.insert(courses).values({
    id,
    slug: input.slug,
    ...content,
    ...publishing,
    ...(input.publish ? { publishedAt: new Date() } : {}),
  });
  return { id, created: true };
}

/** Upserts modules by slug and returns slug → id. Removed modules are deleted later. */
async function upsertModules(
  tx: Tx,
  courseId: string,
  items: readonly ModuleImport[],
): Promise<Map<string, string>> {
  const existing = await tx
    .select({ id: modules.id, slug: modules.slug })
    .from(modules)
    .where(eq(modules.courseId, courseId));
  const ids = new Map(existing.map((row) => [row.slug, row.id]));
  for (const item of items) {
    const id = ids.get(item.slug);
    if (id) {
      await tx
        .update(modules)
        .set({ title: item.title, position: item.position })
        .where(eq(modules.id, id));
    } else {
      const newId = ulid();
      await tx.insert(modules).values({ id: newId, courseId, ...item });
      ids.set(item.slug, newId);
    }
  }
  return ids;
}

async function upsertLessons(
  tx: Tx,
  courseId: string,
  items: readonly LessonImport[],
  moduleIds: ReadonlyMap<string, string>,
): Promise<void> {
  const existing = await tx
    .select({ id: lessons.id, slug: lessons.slug })
    .from(lessons)
    .where(eq(lessons.courseId, courseId));
  const ids = new Map(existing.map((row) => [row.slug, row.id]));
  for (const { moduleSlug, ...item } of items) {
    const values = { ...item, moduleId: moduleIds.get(moduleSlug) ?? "", courseId };
    const id = ids.get(item.slug);
    if (id) await tx.update(lessons).set(values).where(eq(lessons.id, id));
    else await tx.insert(lessons).values({ id: ulid(), ...values });
  }
}

async function deleteRemoved(tx: Tx, courseId: string, input: CourseImport): Promise<void> {
  const keepLessons = input.lessons.map((l) => l.slug);
  const keepModules = input.modules.map((m) => m.slug);
  await tx
    .delete(lessons)
    .where(
      and(
        eq(lessons.courseId, courseId),
        keepLessons.length ? notInArray(lessons.slug, keepLessons) : undefined,
      ),
    );
  await tx
    .delete(modules)
    .where(
      and(
        eq(modules.courseId, courseId),
        keepModules.length ? notInArray(modules.slug, keepModules) : undefined,
      ),
    );
}

/**
 * Creates or updates a course from a content pack, in one transaction. Rows are matched by
 * slug, so lesson ids (and anything referencing them, like progress) survive re-imports.
 */
export async function importCourse(db: Database, input: CourseImport): Promise<ImportSummary> {
  assertConsistent(input);
  return db.transaction(async (tx) => {
    const [stream] = await tx
      .select({ id: streams.id })
      .from(streams)
      .where(eq(streams.slug, input.streamSlug))
      .limit(1);
    if (!stream)
      throw new CourseImportError(
        `stream "${input.streamSlug}" does not exist; run the seed first`,
      );
    const course = await upsertCourse(tx, input, stream.id);
    const moduleIds = await upsertModules(tx, course.id, input.modules);
    await upsertLessons(tx, course.id, input.lessons, moduleIds);
    await deleteRemoved(tx, course.id, input);
    return {
      courseId: course.id,
      created: course.created,
      modules: input.modules.length,
      lessons: input.lessons.length,
    };
  });
}
