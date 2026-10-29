import type { Question } from "@pragya/content";
import { describe, expect, it } from "vitest";
import { learnerView, parseResponse, score } from "./score.js";

const base = { id: "q", lessonId: "l", stem: "Stem?", explanation: "Because." };
const mcq: Question = {
  ...base,
  format: "mcq",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  answer: "b",
  flags: { debatable: "Some texts differ." },
};
const multi: Question = {
  ...base,
  format: "multi_select",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
    { id: "c", text: "C" },
  ],
  answers: ["a", "c"],
};
const tf: Question = { ...base, format: "true_false", answer: false };
const fib: Question = { ...base, format: "fib", answers: ["Liver", "hepatocytes"] };
const why: Question = {
  ...base,
  format: "why",
  modelAnswer: "Enzymes digest stroma-poor tissue.",
  marks: 3,
};

describe("learnerView", () => {
  it("never includes answers, model answers or explanations", () => {
    for (const q of [mcq, multi, tf, fib, why]) {
      const view = JSON.stringify(learnerView(q));
      expect(view).not.toMatch(/"answer"|"answers"|modelAnswer|explanation|Because|Liver|Enzymes/);
    }
  });

  it("keeps what the learner needs to answer", () => {
    expect(learnerView(mcq)).toEqual({
      id: "q",
      format: "mcq",
      stem: "Stem?",
      options: mcq.options,
    });
    expect(learnerView(why)).toEqual({ id: "q", format: "why", stem: "Stem?", marks: 3 });
  });
});

describe("score", () => {
  it.each([
    [mcq, { choice: "b" }, true],
    [mcq, { choice: "a" }, false],
    [multi, { choices: ["c", "a"] }, true],
    [multi, { choices: ["a"] }, false],
    [multi, { choices: ["a", "b", "c"] }, false],
    [tf, { value: false }, true],
    [tf, { value: true }, false],
    [fib, { text: "  LIVER " }, true],
    [fib, { text: "Hepatocytes" }, true],
    [fib, { text: "kidney" }, false],
  ] as const)("%#: scores objective answers", (question, response, correct) => {
    expect(score(question, response).correct).toBe(correct);
  });

  it("returns the key, explanation and debatable note after answering", () => {
    expect(score(mcq, { choice: "a" })).toEqual({
      correct: false,
      key: { choice: "b" },
      explanation: "Because.",
      debatable: "Some texts differ.",
    });
  });

  it("leaves descriptive answers for self-assessment and shows the model answer", () => {
    expect(score(why, { text: "Something" })).toEqual({
      correct: null,
      key: { modelAnswer: "Enzymes digest stroma-poor tissue." },
      explanation: "Because.",
    });
  });
});

describe("parseResponse", () => {
  it("accepts the response shape that matches the question format", () => {
    expect(parseResponse(mcq, { choice: "b" })).toEqual({ choice: "b" });
    expect(parseResponse(multi, { choices: ["a", "c"] })).toEqual({ choices: ["a", "c"] });
    expect(parseResponse(tf, { value: true })).toEqual({ value: true });
    expect(parseResponse(fib, { text: "liver" })).toEqual({ text: "liver" });
  });

  it.each([
    [mcq, { choice: "z" }],
    [mcq, { value: true }],
    [multi, { choices: [] }],
    [multi, { choices: ["a", "a"] }],
    [tf, { value: "yes" }],
    [fib, { text: "" }],
    [fib, { text: "x".repeat(2001) }],
    [why, { text: 42 }],
  ] as const)("%#: rejects a mismatched or invalid response", (question, response) => {
    expect(() => parseResponse(question, response)).toThrow();
  });
});
