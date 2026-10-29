import { createHash } from "node:crypto";
import type { Block, PackManifest, Question } from "@pragya/content";

export const BUNDLE_FORMAT_VERSION = 1;

export interface BundledModule {
  readonly id: string;
  readonly title: string;
  readonly position: number;
}

export interface BundledLesson {
  readonly id: string;
  readonly moduleId: string;
  readonly title: string;
  readonly position: number;
  readonly isPreview: boolean;
  readonly blocks: readonly Block[];
}

export interface PackBundle {
  readonly formatVersion: typeof BUNDLE_FORMAT_VERSION;
  readonly manifest: PackManifest;
  readonly modules: readonly BundledModule[];
  readonly lessons: readonly BundledLesson[];
  readonly questions: readonly Question[];
  /** SHA-256 of the bundle's other fields, so importers can detect corruption or tampering. */
  readonly checksum: string;
}

export type UnsignedBundle = Omit<PackBundle, "checksum">;

/** JSON with object keys sorted by code unit (not locale), so equal content always hashes the same. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );
}

export const checksumOf = (bundle: UnsignedBundle): string =>
  createHash("sha256").update(canonicalJson(bundle)).digest("hex");

export const signBundle = (bundle: UnsignedBundle): PackBundle => ({
  ...bundle,
  checksum: checksumOf(bundle),
});

export function verifyChecksum(bundle: PackBundle): boolean {
  const { checksum, ...rest } = bundle;
  return checksumOf(rest) === checksum;
}
