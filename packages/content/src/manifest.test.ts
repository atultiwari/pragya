import { describe, expect, it } from "vitest";
import { packManifestSchema } from "./manifest.js";

const manifest = {
  schemaVersion: 1,
  id: "sample-pathology",
  version: "0.1.0",
  title: "Pathology (sample)",
  streamSlug: "mbbs",
  summary: "Sample pack.",
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

describe("packManifestSchema", () => {
  it("accepts a valid manifest and fills defaults", () => {
    const parsed = packManifestSchema.parse(manifest);
    expect(parsed.language).toBe("en");
    expect(parsed.pricePaise).toBe(0);
    expect(parsed.visibility).toBe("public");
    expect(parsed.modules[0]?.lessons[1]?.isPreview).toBe(false);
  });

  it.each([
    ["bad semver", { ...manifest, version: "1.0" }],
    ["unsafe id", { ...manifest, id: "Sample Pathology!" }],
    ["future schema", { ...manifest, schemaVersion: 2 }],
    ["file outside pack", { ...manifest, questionFiles: ["../other.json"] }],
    ["absolute file", { ...manifest, questionFiles: ["/etc/passwd"] }],
    ["NUL byte in path", { ...manifest, questionFiles: ["questions/a\u0000.json"] }],
    ["no modules", { ...manifest, modules: [] }],
    [
      "duplicate lesson id",
      {
        ...manifest,
        modules: [
          ...manifest.modules,
          {
            id: "m2",
            title: "M2",
            lessons: [{ id: "overview", title: "Again", file: "lessons/again.md" }],
          },
        ],
      },
    ],
  ])("rejects %s", (_label, candidate) => {
    expect(packManifestSchema.safeParse(candidate).success).toBe(false);
  });
});
