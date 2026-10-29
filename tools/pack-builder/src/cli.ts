#!/usr/bin/env node
import { createDb, importCourse } from "@pragya/db";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { PackBundle } from "./bundle.js";
import { copyFigures } from "./assets.js";
import { loadPack } from "./load.js";
import { toCourseImport } from "./to-import.js";

const USAGE = `Usage:
  pack-builder check  <pack-dir>                     validate a pack
  pack-builder build  <pack-dir> [--out <file>]      validate and write a bundle (default dist/<id>@<version>.json)
  pack-builder import <pack-dir | bundle.json> [--publish] [--assets-dir <dir>]
      import into MySQL (needs DATABASE_URL) and copy figures to --assets-dir
      (default $CONTENT_ASSETS_DIR, else var/content at the repo root)`;

/** Outside any public folder: the API serves figures only to learners who may see them (D-023). */
const DEFAULT_ASSETS_DIR = resolve(import.meta.dirname, "../../../var/content");

async function loadOrExit(dir: string): Promise<PackBundle> {
  const result = await loadPack(dir);
  if (!result.ok) {
    console.error(`✗ ${dir}: ${result.errors.length} problem(s)`);
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  return result.bundle;
}

async function readBundle(source: string): Promise<PackBundle> {
  if (!source.endsWith(".json")) return loadOrExit(source);
  return JSON.parse(await readFile(source, "utf8")) as PackBundle;
}

async function importBundle(bundle: PackBundle, publish: boolean): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for import");
  const handle = createDb(databaseUrl);
  try {
    const summary = await importCourse(handle.db, toCourseImport(bundle, { publish }));
    console.warn(
      `✓ ${summary.created ? "created" : "updated"} course ${bundle.manifest.id}@${bundle.manifest.version} ` +
        `(${summary.modules} modules, ${summary.lessons} lessons${publish ? ", published" : ""}) [${summary.courseId}]`,
    );
    if (bundle.questions.length > 0) {
      console.warn(
        `  note: ${bundle.questions.length} questions validated; storing them arrives with the assessment slice`,
      );
    }
  } finally {
    await handle.close();
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      out: { type: "string" },
      publish: { type: "boolean" },
      "assets-dir": { type: "string" },
    },
  });
  const [command, target] = positionals;
  if (!command || !target) {
    console.error(USAGE);
    process.exit(2);
  }
  switch (command) {
    case "check": {
      const bundle = await loadOrExit(target);
      console.warn(
        `✓ ${bundle.manifest.id}@${bundle.manifest.version}: ${bundle.lessons.length} lessons, ${bundle.questions.length} questions`,
      );
      return;
    }
    case "build": {
      const bundle = await loadOrExit(target);
      const out = resolve(
        values.out ?? `dist/${bundle.manifest.id}@${bundle.manifest.version}.json`,
      );
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, `${JSON.stringify(bundle, null, 2)}\n`);
      console.warn(`✓ wrote ${out} (sha256 ${bundle.checksum.slice(0, 12)}…)`);
      return;
    }
    case "import": {
      const bundle = await readBundle(target);
      await importBundle(bundle, values.publish ?? false);
      if (target.endsWith(".json")) {
        console.warn("  note: figures are copied only when importing from a pack directory");
        return;
      }
      const assetsDir = resolve(
        values["assets-dir"] ?? process.env.CONTENT_ASSETS_DIR ?? DEFAULT_ASSETS_DIR,
      );
      const copied = await copyFigures(target, bundle, assetsDir);
      console.warn(`  copied ${copied} figure(s) to ${join(assetsDir, bundle.manifest.id)}`);
      return;
    }
    default:
      console.error(`Unknown command "${command}"\n${USAGE}`);
      process.exit(2);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
