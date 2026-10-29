import { z } from "zod";
import { slugSchema } from "./common.js";

const optionId = z.string().regex(/^[a-f]$/, "option ids are a–f");

const option = z.object({ id: optionId, text: z.string().trim().min(1).max(1000) });

const CURRENT_YEAR = new Date().getUTCFullYear();

const common = {
  id: slugSchema,
  /** The lesson (topic) this question belongs to; drives per-topic practice and mastery. */
  lessonId: slugSchema,
  stem: z.string().trim().min(1).max(4000),
  explanation: z.string().trim().min(1).max(4000).optional(),
  marks: z.number().positive().max(100).optional(),
  yearsAsked: z.array(z.number().int().min(1950).max(CURRENT_YEAR)).max(50).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(slugSchema).max(20).optional(),
  flags: z
    .object({
      /** Shown to learners next to the key when sources disagree. */
      debatable: z.string().trim().min(1).max(1000).optional(),
      incomplete: z.boolean().optional(),
    })
    .optional(),
};

const options = z
  .array(option)
  .min(2)
  .max(6)
  .refine(
    (opts) => new Set(opts.map((o) => o.id)).size === opts.length,
    "option ids must be unique",
  );

const optionIds = (opts: readonly { id: string }[]) => new Set(opts.map((o) => o.id));

const singleChoice = z
  .object({ ...common, format: z.enum(["mcq", "scenario_mcq"]), options, answer: optionId })
  .refine((q) => optionIds(q.options).has(q.answer), {
    message: "answer must be one of the options",
    path: ["answer"],
  });

const multiSelect = z
  .object({
    ...common,
    format: z.literal("multi_select"),
    options,
    answers: z.array(optionId).min(1),
  })
  .refine((q) => q.answers.every((a) => optionIds(q.options).has(a)), {
    message: "answers must be options",
    path: ["answers"],
  });

const trueFalse = z.object({ ...common, format: z.literal("true_false"), answer: z.boolean() });

const fillInBlank = z.object({
  ...common,
  format: z.literal("fib"),
  /** Accepted answers, compared case-insensitively after trimming. */
  answers: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
});

const descriptive = z.object({
  ...common,
  format: z.enum(["saq", "laq", "why", "case"]),
  modelAnswer: z.string().trim().min(1).max(20_000),
});

export const questionSchema = z.union([
  singleChoice,
  multiSelect,
  trueFalse,
  fillInBlank,
  descriptive,
]);

export type Question = z.infer<typeof questionSchema>;
export type QuestionFormat = Question["format"];

export const questionFileSchema = z.array(questionSchema).min(1).max(5000);
