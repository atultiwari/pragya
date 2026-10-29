import type { CourseImport } from "@pragya/db";
import { verifyChecksum, type PackBundle } from "./bundle.js";

/** Maps a verified pack bundle onto the database's course import. */
export function toCourseImport(
  bundle: PackBundle,
  options: { readonly publish: boolean },
): CourseImport {
  if (!verifyChecksum(bundle))
    throw new Error("Bundle checksum does not match its content; rebuild the pack");
  const { manifest } = bundle;
  return {
    slug: manifest.id,
    title: manifest.title,
    summary: manifest.summary,
    streamSlug: manifest.streamSlug,
    language: manifest.language,
    pricePaise: manifest.pricePaise,
    visibility: manifest.visibility,
    contentVersion: manifest.version,
    contentChecksum: bundle.checksum,
    publish: options.publish,
    modules: bundle.modules.map(({ id, title, position }) => ({ slug: id, title, position })),
    lessons: bundle.lessons.map(({ id, moduleId, ...lesson }) => ({
      slug: id,
      moduleSlug: moduleId,
      ...lesson,
    })),
  };
}
