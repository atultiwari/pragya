import { z } from "zod";

/** Lower-case kebab-case identifier used for packs, modules, lessons and questions. */
export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lower-case kebab-case (a-z, 0-9, -)");

/** A forward-slash path inside the pack: no scheme, no leading slash, no `..` segments. */
export const packPathSchema = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (path) =>
      !path.startsWith("/") &&
      !path.includes("\0") &&
      !path.includes("\\") &&
      !/^[a-z][a-z0-9+.-]*:/i.test(path) &&
      path.split("/").every((segment) => segment !== ".." && segment !== "." && segment !== ""),
    "must be a relative path inside the pack",
  );
