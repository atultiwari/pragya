import { z } from "zod";
import { packPathSchema, slugSchema } from "./common.js";

export const PACK_SCHEMA_VERSION = 1;

const lessonEntry = z.object({
  id: slugSchema,
  title: z.string().trim().min(1).max(200),
  file: packPathSchema.refine((path) => path.endsWith(".md"), "lesson files are Markdown (.md)"),
  isPreview: z.boolean().default(false),
});

const moduleEntry = z.object({
  id: slugSchema,
  title: z.string().trim().min(1).max(200),
  lessons: z.array(lessonEntry).min(1).max(200),
});

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): boolean =>
  new Set(items.map(key)).size === items.length;

export const packManifestSchema = z
  .object({
    schemaVersion: z.literal(PACK_SCHEMA_VERSION),
    id: slugSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver, e.g. 1.2.0"),
    title: z.string().trim().min(1).max(200),
    streamSlug: slugSchema,
    summary: z.string().trim().min(1).max(2000),
    language: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .default("en"),
    pricePaise: z.number().int().min(0).default(0),
    visibility: z.enum(["public", "institute", "public_and_institute"]).default("public"),
    modules: z.array(moduleEntry).min(1).max(100),
    questionFiles: z.array(packPathSchema).max(100).default([]),
  })
  .refine((m) => uniqueBy(m.modules, (mod) => mod.id), {
    message: "module ids must be unique",
    path: ["modules"],
  })
  .refine(
    (m) =>
      uniqueBy(
        m.modules.flatMap((mod) => mod.lessons),
        (lesson) => lesson.id,
      ),
    {
      message: "lesson ids must be unique across the pack",
      path: ["modules"],
    },
  );

export type PackManifest = z.infer<typeof packManifestSchema>;
