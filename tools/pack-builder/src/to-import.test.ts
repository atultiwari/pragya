import { describe, expect, it } from "vitest";
import { signBundle } from "./bundle.js";
import { toCourseImport } from "./to-import.js";

const bundle = signBundle({
  formatVersion: 1,
  manifest: {
    schemaVersion: 1,
    id: "sample-pathology",
    version: "0.2.0",
    title: "Pathology (sample)",
    streamSlug: "mbbs",
    summary: "Sample.",
    language: "en",
    pricePaise: 49900,
    visibility: "public",
    modules: [
      {
        id: "cell-injury",
        title: "Cell injury",
        lessons: [
          { id: "overview", title: "Overview", file: "lessons/overview.md", isPreview: true },
        ],
      },
    ],
    questionFiles: [],
  },
  modules: [{ id: "cell-injury", title: "Cell injury", position: 1 }],
  lessons: [
    {
      id: "overview",
      moduleId: "cell-injury",
      title: "Overview",
      position: 1,
      isPreview: true,
      blocks: [{ type: "paragraph", text: "x" }],
    },
  ],
  questions: [
    {
      id: "q1",
      lessonId: "overview",
      format: "true_false",
      stem: "S?",
      answer: true,
      tags: ["intro"],
    },
  ],
});

describe("toCourseImport", () => {
  it("maps a bundle onto the database import shape", () => {
    expect(toCourseImport(bundle, { publish: true })).toEqual({
      slug: "sample-pathology",
      title: "Pathology (sample)",
      summary: "Sample.",
      streamSlug: "mbbs",
      language: "en",
      pricePaise: 49900,
      visibility: "public",
      contentVersion: "0.2.0",
      contentChecksum: bundle.checksum,
      publish: true,
      modules: [{ slug: "cell-injury", title: "Cell injury", position: 1 }],
      lessons: [
        {
          slug: "overview",
          moduleSlug: "cell-injury",
          title: "Overview",
          position: 1,
          isPreview: true,
          blocks: [{ type: "paragraph", text: "x" }],
        },
      ],
      questions: [
        {
          slug: "q1",
          lessonSlug: "overview",
          format: "true_false",
          difficulty: null,
          tags: ["intro"],
          body: {
            id: "q1",
            lessonId: "overview",
            format: "true_false",
            stem: "S?",
            answer: true,
            tags: ["intro"],
          },
        },
      ],
    });
  });

  it("refuses a bundle whose checksum does not match", () => {
    const tampered = { ...bundle, lessons: [] };
    expect(() => toCourseImport(tampered, { publish: false })).toThrow(/checksum/);
  });
});

describe("checksum canonicalisation", () => {
  it("orders keys by code unit, independent of locale", async () => {
    const { checksumOf } = await import("./bundle.js");
    const a = checksumOf({ ...bundle, manifest: { ...bundle.manifest } } as never);
    const reordered = Object.fromEntries(Object.entries(bundle.manifest).reverse());
    const b = checksumOf({ ...bundle, manifest: reordered } as never);
    expect(a).toBe(b);
  });
});
