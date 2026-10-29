import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPack, verifyChecksum } from "./load.js";

const manifest = {
  schemaVersion: 1,
  id: "test-pack",
  version: "1.0.0",
  title: "Test pack",
  streamSlug: "mbbs",
  summary: "For tests.",
  modules: [
    {
      id: "cell-injury",
      title: "Cell injury",
      lessons: [
        { id: "overview", title: "Overview", file: "lessons/overview.md", isPreview: true },
        { id: "necrosis", title: "Necrosis", file: "lessons/necrosis.md" },
      ],
    },
  ],
  questionFiles: ["questions/cell-injury.json"],
};

const questions = [
  {
    id: "q-1",
    lessonId: "overview",
    format: "true_false",
    stem: "Hypoxia injures cells.",
    answer: true,
  },
  {
    id: "q-2",
    lessonId: "necrosis",
    format: "true_false",
    stem: "Karyolysis is reversible.",
    answer: false,
  },
];

let dir: string;

const put = async (path: string, content: string | object) => {
  const full = join(dir, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, typeof content === "string" ? content : JSON.stringify(content));
};

const writeValidPack = async () => {
  await put("manifest.json", manifest);
  await put(
    "lessons/overview.md",
    "## Why it matters\n\nCells adapt, then get injured.\n\n![A cell](figures/cell.svg)",
  );
  await put(
    "lessons/necrosis.md",
    '## Types\n\n- Coagulative\n- Liquefactive\n\n```quiz\n{ "poolRef": "necrosis" }\n```',
  );
  await put("figures/cell.svg", "<svg/>");
  await put("questions/cell-injury.json", questions);
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pragya-pack-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadPack", () => {
  it("bundles a valid pack in manifest order with a verifiable checksum", async () => {
    await writeValidPack();
    const result = await loadPack(dir);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    const { bundle } = result;
    expect(bundle.modules).toEqual([{ id: "cell-injury", title: "Cell injury", position: 1 }]);
    expect(bundle.lessons.map((l) => [l.id, l.moduleId, l.position, l.isPreview])).toEqual([
      ["overview", "cell-injury", 1, true],
      ["necrosis", "cell-injury", 2, false],
    ]);
    expect(bundle.lessons[0]?.blocks[2]).toEqual({
      type: "figure",
      src: "figures/cell.svg",
      alt: "A cell",
    });
    expect(bundle.questions).toHaveLength(2);
    expect(bundle.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyChecksum(bundle)).toBe(true);
    expect(verifyChecksum({ ...bundle, manifest: { ...bundle.manifest, title: "Tampered" } })).toBe(
      false,
    );
  });

  it("produces the same checksum for the same content", async () => {
    await writeValidPack();
    const [a, b] = await Promise.all([loadPack(dir), loadPack(dir)]);
    expect(a.ok && b.ok && a.bundle.checksum === b.bundle.checksum).toBe(true);
  });

  it("reports a missing or malformed manifest", async () => {
    expect(await loadPack(dir)).toEqual({ ok: false, errors: ["manifest.json: file not found"] });
    await put("manifest.json", "{ nope");
    const result = await loadPack(dir);
    expect(result.ok === false && result.errors[0]).toMatch(/manifest.json: invalid JSON/);
  });

  it("collects lesson, figure, question and reference problems together", async () => {
    await writeValidPack();
    await put("lessons/overview.md", "# Title\n\n![Missing](figures/missing.svg)");
    await put("questions/cell-injury.json", [
      ...questions,
      { id: "q-1", lessonId: "overview", format: "true_false", stem: "Duplicate id", answer: true },
      { id: "q-3", lessonId: "no-such-lesson", format: "true_false", stem: "Orphan", answer: true },
    ]);
    await put("lessons/necrosis.md", '```quiz\n{ "poolRef": "unknown-pool" }\n```');
    const result = await loadPack(dir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/lessons\/overview\.md: block 1: level-1 heading/),
        expect.stringMatching(/lessons\/overview\.md: figure "figures\/missing\.svg" not found/),
        expect.stringMatching(/questions\/cell-injury\.json: duplicate question id "q-1"/),
        expect.stringMatching(/question "q-3": unknown lesson "no-such-lesson"/),
        expect.stringMatching(
          /lessons\/necrosis\.md: quiz pool "unknown-pool" matches no lesson or question tag/,
        ),
      ]),
    );
  });

  it("refuses files that escape the pack through a symlink", async () => {
    await writeValidPack();
    const outside = await mkdtemp(join(tmpdir(), "pragya-outside-"));
    try {
      await writeFile(join(outside, "secret.md"), "## Secret");
      await rm(join(dir, "lessons/overview.md"));
      await symlink(join(outside, "secret.md"), join(dir, "lessons/overview.md"));
      const result = await loadPack(dir);
      expect(result.ok === false && result.errors.join()).toMatch(
        /lessons\/overview\.md: resolves outside the pack/,
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("reports a directory where a file was expected", async () => {
    await writeValidPack();
    await rm(join(dir, "lessons/necrosis.md"));
    await mkdir(join(dir, "lessons/necrosis.md"));
    const result = await loadPack(dir);
    expect(result.ok === false && result.errors.join()).toMatch(
      /lessons\/necrosis\.md: is a directory/,
    );
  });

  it("reports schema errors in a question file with the file name", async () => {
    await writeValidPack();
    await put("questions/cell-injury.json", [{ id: "Bad Id", format: "mcq" }]);
    const result = await loadPack(dir);
    expect(result.ok === false && result.errors.join()).toMatch(/questions\/cell-injury\.json:/);
  });
});
