import type { Question } from "@pragya/content";
import { z } from "zod";

type Option = { readonly id: string; readonly text: string };

/** What a learner sees before answering: never the key, model answer or explanation. */
export type LearnerQuestion =
  | {
      readonly id: string;
      readonly format: "mcq" | "scenario_mcq" | "multi_select";
      readonly stem: string;
      readonly options: readonly Option[];
    }
  | { readonly id: string; readonly format: "true_false" | "fib"; readonly stem: string }
  | {
      readonly id: string;
      readonly format: "saq" | "laq" | "why" | "case";
      readonly stem: string;
      readonly marks?: number;
    };

export type Response =
  | { readonly choice: string }
  | { readonly choices: readonly string[] }
  | { readonly value: boolean }
  | { readonly text: string };

export interface ScoreResult {
  /** null for descriptive formats, which the learner self-assesses against the model answer. */
  readonly correct: boolean | null;
  readonly key:
    | Response
    | { readonly choices: readonly string[] }
    | { readonly modelAnswer: string }
    | { readonly accepted: readonly string[] };
  readonly explanation?: string;
  readonly debatable?: string;
}

const MAX_TEXT = 2000;

export function learnerView(question: Question): LearnerQuestion {
  const { id, stem } = question;
  switch (question.format) {
    case "mcq":
    case "scenario_mcq":
    case "multi_select":
      return { id, format: question.format, stem, options: question.options };
    case "true_false":
    case "fib":
      return { id, format: question.format, stem };
    default:
      return {
        id,
        format: question.format,
        stem,
        ...(question.marks !== undefined ? { marks: question.marks } : {}),
      };
  }
}

/** Validates an untrusted response against the shape the question's format expects. */
export function parseResponse(question: Question, input: unknown): Response {
  switch (question.format) {
    case "mcq":
    case "scenario_mcq": {
      const ids = question.options.map((o) => o.id) as [string, ...string[]];
      return z
        .object({ choice: z.enum(ids) })
        .strict()
        .parse(input);
    }
    case "multi_select": {
      const ids = question.options.map((o) => o.id) as [string, ...string[]];
      return z
        .object({
          choices: z
            .array(z.enum(ids))
            .min(1)
            .refine((c) => new Set(c).size === c.length, "duplicate choice"),
        })
        .strict()
        .parse(input);
    }
    case "true_false":
      return z.object({ value: z.boolean() }).strict().parse(input);
    default:
      return z
        .object({ text: z.string().trim().min(1).max(MAX_TEXT) })
        .strict()
        .parse(input);
  }
}

const normalise = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, " ");

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item) => b.includes(item));

function check(question: Question, response: Response): Pick<ScoreResult, "correct" | "key"> {
  switch (question.format) {
    case "mcq":
    case "scenario_mcq":
      return {
        correct: "choice" in response && response.choice === question.answer,
        key: { choice: question.answer },
      };
    case "multi_select":
      return {
        correct: "choices" in response && sameSet(response.choices, question.answers),
        key: { choices: question.answers },
      };
    case "true_false":
      return {
        correct: "value" in response && response.value === question.answer,
        key: { value: question.answer },
      };
    case "fib":
      return {
        correct:
          "text" in response &&
          question.answers.some((a) => normalise(a) === normalise(response.text)),
        key: { accepted: question.answers },
      };
    default:
      return { correct: null, key: { modelAnswer: question.modelAnswer } };
  }
}

/** Scores a validated response and reveals the key, explanation and any "debatable" note. */
export function score(question: Question, response: Response): ScoreResult {
  return {
    ...check(question, response),
    ...(question.explanation ? { explanation: question.explanation } : {}),
    ...(question.flags?.debatable ? { debatable: question.flags.debatable } : {}),
  };
}
