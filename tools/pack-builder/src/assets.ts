import { join } from "node:path";
import type { PackBundle } from "./bundle.js";
import { openPackFiles } from "./pack-files.js";

/**
 * Copies every figure a pack references into `<assetsDir>/<pack id>/<src>`, where the API serves
 * them to learners allowed to see the lessons that use them (D-023). Paths were validated by the loader; reads stay confined to the pack.
 */
export async function copyFigures(
  packDir: string,
  bundle: PackBundle,
  assetsDir: string,
): Promise<number> {
  const files = await openPackFiles(packDir);
  const sources = new Set(
    bundle.lessons.flatMap((lesson) =>
      lesson.blocks.flatMap((block) => (block.type === "figure" ? [block.src] : [])),
    ),
  );
  for (const src of sources) await files.copyTo(src, join(assetsDir, bundle.manifest.id, src));
  return sources.size;
}
