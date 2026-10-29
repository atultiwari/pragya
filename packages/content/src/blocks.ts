import { z } from "zod";
import { packPathSchema, slugSchema } from "./common.js";

/** Inline text may use Markdown emphasis and links; renderers must escape everything else. */
const inlineText = z.string().trim().min(1).max(10_000);

export const CALLOUT_VARIANTS = ["clinical", "memory", "exam", "note", "warning"] as const;

const heading = z.object({
  type: z.literal("heading"),
  // Level 1 is the lesson title, which comes from the manifest.
  level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  text: inlineText,
});

const paragraph = z.object({ type: z.literal("paragraph"), text: inlineText });

const list = z.object({
  type: z.literal("list"),
  ordered: z.boolean(),
  items: z.array(inlineText).min(1).max(200),
});

const table = z
  .object({
    type: z.literal("table"),
    header: z.array(z.string().trim()).min(1).max(12),
    rows: z.array(z.array(z.string().trim())).min(1).max(500),
  })
  .refine(
    (t) => t.rows.every((row) => row.length === t.header.length),
    "every row needs one cell per column",
  );

const callout = z.object({
  type: z.literal("callout"),
  variant: z.enum(CALLOUT_VARIANTS),
  title: z.string().trim().min(1).max(120).optional(),
  text: inlineText,
});

const figure = z.object({
  type: z.literal("figure"),
  src: packPathSchema,
  alt: z.string().trim().min(1, "figures need alt text").max(300),
  caption: z.string().trim().min(1).max(500).optional(),
});

const VIDEO_IDS = { youtube: /^[A-Za-z0-9_-]{11}$/, bunny: /^[0-9a-f-]{36}$/ } as const;

const video = z
  .object({
    type: z.literal("video"),
    provider: z.enum(["youtube", "bunny"]),
    videoId: z.string(),
    startSeconds: z.number().int().min(0).optional(),
  })
  .refine((v) => VIDEO_IDS[v.provider].test(v.videoId), {
    message: "invalid video id for provider",
    path: ["videoId"],
  });

const sim = z.object({
  type: z.literal("sim"),
  ref: slugSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

const quiz = z.object({ type: z.literal("quiz"), poolRef: slugSchema });

export const blockSchema = z.discriminatedUnion("type", [
  heading,
  paragraph,
  list,
  table,
  callout,
  figure,
  video,
  sim,
  quiz,
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
