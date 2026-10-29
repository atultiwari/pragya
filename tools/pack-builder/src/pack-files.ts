import { copyFile, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { join, sep } from "node:path";

export type FileRead =
  { readonly ok: true; readonly text: string } | { readonly ok: false; readonly error: string };

const isMissing = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error.code === "ENOENT" || error.code === "ENOTDIR");

/** Read access to one pack directory that refuses anything resolving outside it (e.g. via symlinks). */
export interface PackFiles {
  read(relativePath: string): Promise<FileRead>;
  exists(relativePath: string): Promise<boolean>;
  /** Copies a pack file to an absolute destination, byte for byte. */
  copyTo(relativePath: string, destination: string): Promise<void>;
}

export async function openPackFiles(directory: string): Promise<PackFiles> {
  const root = await realpath(directory);
  const inside = (path: string) => path === root || path.startsWith(root + sep);

  async function resolve(relativePath: string): Promise<string | "missing" | "outside"> {
    try {
      const resolved = await realpath(join(root, relativePath));
      return inside(resolved) ? resolved : "outside";
    } catch (error: unknown) {
      if (isMissing(error)) return "missing";
      throw error;
    }
  }

  return {
    async read(relativePath) {
      const resolved = await resolve(relativePath);
      if (resolved === "missing") return { ok: false, error: `${relativePath}: file not found` };
      if (resolved === "outside")
        return { ok: false, error: `${relativePath}: resolves outside the pack` };
      try {
        return { ok: true, text: await readFile(resolved, "utf8") };
      } catch (error: unknown) {
        if (error instanceof Error && "code" in error && error.code === "EISDIR") {
          return { ok: false, error: `${relativePath}: is a directory, expected a file` };
        }
        throw error;
      }
    },
    async copyTo(relativePath, destination) {
      const resolved = await resolve(relativePath);
      if (resolved === "missing" || resolved === "outside") {
        throw new Error(
          `${relativePath}: cannot copy (${resolved === "missing" ? "not found" : "outside the pack"})`,
        );
      }
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(resolved, destination);
    },
    async exists(relativePath) {
      const resolved = await resolve(relativePath);
      if (resolved === "missing" || resolved === "outside") return false;
      return (await stat(resolved)).isFile();
    },
  };
}
