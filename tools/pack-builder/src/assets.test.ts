import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFigures } from "./assets.js";
import { signBundle } from "./bundle.js";

let packDir: string;
let assetsDir: string;

const bundle = signBundle({
  formatVersion: 1,
  manifest: {
    schemaVersion: 1,
    id: "pack-a",
    version: "1.0.0",
    title: "A",
    streamSlug: "mbbs",
    summary: "A",
    language: "en",
    pricePaise: 0,
    visibility: "public",
    modules: [
      {
        id: "m",
        title: "M",
        lessons: [{ id: "l", title: "L", file: "lessons/l.md", isPreview: false }],
      },
    ],
    questionFiles: [],
  },
  modules: [{ id: "m", title: "M", position: 1 }],
  lessons: [
    {
      id: "l",
      moduleId: "m",
      title: "L",
      position: 1,
      isPreview: false,
      blocks: [
        { type: "figure", src: "figures/a.png", alt: "A" },
        { type: "figure", src: "figures/a.png", alt: "A again" },
        { type: "figure", src: "figures/deep/b.svg", alt: "B" },
      ],
    },
  ],
  questions: [],
});

beforeEach(async () => {
  packDir = await mkdtemp(join(tmpdir(), "pragya-pack-"));
  assetsDir = await mkdtemp(join(tmpdir(), "pragya-assets-"));
  await mkdir(join(packDir, "figures/deep"), { recursive: true });
  await writeFile(
    join(packDir, "figures/a.png"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]),
  );
  await writeFile(join(packDir, "figures/deep/b.svg"), "<svg/>");
});

afterEach(async () => {
  await rm(packDir, { recursive: true, force: true });
  await rm(assetsDir, { recursive: true, force: true });
});

describe("copyFigures", () => {
  it("copies each referenced figure once, byte for byte, under the pack id", async () => {
    expect(await copyFigures(packDir, bundle, assetsDir)).toBe(2);
    expect(await readFile(join(assetsDir, "pack-a/figures/a.png"))).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]),
    );
    expect(await readFile(join(assetsDir, "pack-a/figures/deep/b.svg"), "utf8")).toBe("<svg/>");
  });

  it("fails loudly when a referenced figure has disappeared", async () => {
    await rm(join(packDir, "figures/deep/b.svg"));
    await expect(copyFigures(packDir, bundle, assetsDir)).rejects.toThrow(
      /figures\/deep\/b\.svg: cannot copy \(not found\)/,
    );
  });

  it("refuses to copy a figure that resolves outside the pack", async () => {
    const outside = await mkdtemp(join(tmpdir(), "pragya-outside-"));
    try {
      await writeFile(join(outside, "x.svg"), "<svg/>");
      await rm(join(packDir, "figures/deep/b.svg"));
      await symlink(join(outside, "x.svg"), join(packDir, "figures/deep/b.svg"));
      await expect(copyFigures(packDir, bundle, assetsDir)).rejects.toThrow(/outside the pack/);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
