import type { LearnerQuestion } from "@pragya/assessment";
import { describe, expect, it } from "vitest";
import { describeKey, isAnswerReady, toResponse } from "./practice";

const mcq: LearnerQuestion = {
  id: "q",
  format: "mcq",
  stem: "?",
  options: [
    { id: "a", text: "Myocardium" },
    { id: "b", text: "Tuberculosis" },
  ],
};

describe("describeKey", () => {
  it.each([
    [mcq, { choice: "b" }, "Tuberculosis"],
    [
      { ...mcq, format: "multi_select" } as LearnerQuestion,
      { choices: ["a", "b"] },
      "Myocardium; Tuberculosis",
    ],
    [{ id: "q", format: "true_false", stem: "?" } as LearnerQuestion, { value: false }, "False"],
    [
      { id: "q", format: "fib", stem: "?" } as LearnerQuestion,
      { accepted: ["liver", "hepatocytes"] },
      "liver (also accepted: hepatocytes)",
    ],
    [
      { id: "q", format: "why", stem: "?" } as LearnerQuestion,
      { modelAnswer: "Enzymes." },
      "Enzymes.",
    ],
  ] as const)("%#", (question, key, expected) => {
    expect(describeKey(question, key)).toBe(expected);
  });
});

describe("isAnswerReady", () => {
  it.each([
    [mcq, {}, false],
    [mcq, { choice: "a" }, true],
    [{ ...mcq, format: "multi_select" } as LearnerQuestion, { choices: [] }, false],
    [{ id: "q", format: "true_false", stem: "?" } as LearnerQuestion, { value: false }, true],
    [{ id: "q", format: "fib", stem: "?" } as LearnerQuestion, { text: "  " }, false],
    [{ id: "q", format: "saq", stem: "?" } as LearnerQuestion, { text: "Swelling" }, true],
  ] as const)("%#", (question, draft, expected) => {
    expect(isAnswerReady(question, draft)).toBe(expected);
  });
});

describe("toResponse", () => {
  it.each([
    [mcq, { choice: "a", text: "stray" }, { choice: "a" }],
    [{ ...mcq, format: "multi_select" } as LearnerQuestion, { choices: ["b"] }, { choices: ["b"] }],
    [
      { id: "q", format: "true_false", stem: "?" } as LearnerQuestion,
      { value: true },
      { value: true },
    ],
    [
      { id: "q", format: "fib", stem: "?" } as LearnerQuestion,
      { text: "liver", choice: "a" },
      { text: "liver" },
    ],
    [{ id: "q", format: "case", stem: "?" } as LearnerQuestion, {}, { text: "" }],
  ] as const)("%#: sends only the fields the format expects", (question, draft, expected) => {
    expect(toResponse(question, draft)).toEqual(expected);
  });
});
