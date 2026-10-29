#!/usr/bin/env node
import { createDb, importCourse } from "@pragya/db";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { PackBundle } from "./bundle.js";
import { loadPack } from "./load.js";
import { toCourseImport } from "./to-import.js";

const USAGE = `Usage:
  pack-builder check  <pack-dir>                     validate a pack
  pack-builder build  <pack-dir> [--out <file>]      validate and write a bundle (default dist/<id>@<version>.json)
  pack-builder import <pack-dir | bundle.json> [--publish]   import into MySQL (needs DATABASE_URL)`;

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
    options: { out: { type: "string" }, publish: { type: "boolean" } },
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
    case "import":
      return importBundle(await readBundle(target), values.publish ?? false);
    default:
      console.error(`Unknown command "${command}"\n${USAGE}`);
      process.exit(2);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
