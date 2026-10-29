import { describe, expect, it } from "vitest";
import { questionSchema } from "./questions.js";

const base = {
  id: "ci-001",
  lessonId: "cell-injury-overview",
  stem: "Which change is irreversible?",
};

describe("questionSchema", () => {
  it("accepts a single-answer MCQ whose answer is one of its options", () => {
    const q = {
      ...base,
      format: "mcq",
      options: [
        { id: "a", text: "Cell swelling" },
        { id: "b", text: "Karyolysis" },
      ],
      answer: "b",
      explanation: "Nuclear dissolution marks cell death.",
    };
    expect(questionSchema.parse(q)).toMatchObject({ format: "mcq", answer: "b" });
  });

  it("rejects an MCQ answer that is not an option", () => {
    const q = {
      ...base,
      format: "mcq",
      options: [
        { id: "a", text: "x" },
        { id: "b", text: "y" },
      ],
      answer: "c",
    };
    expect(questionSchema.safeParse(q).success).toBe(false);
  });

  it("rejects duplicate option ids", () => {
    const q = {
      ...base,
      format: "mcq",
      options: [
        { id: "a", text: "x" },
        { id: "a", text: "y" },
      ],
      answer: "a",
    };
    expect(questionSchema.safeParse(q).success).toBe(false);
  });

  it("accepts multi-select, true/false, fill-in and descriptive formats", () => {
    const options = [
      { id: "a", text: "Pyknosis" },
      { id: "b", text: "Karyorrhexis" },
      { id: "c", text: "Fatty change" },
    ];
    expect(
      questionSchema.safeParse({ ...base, format: "multi_select", options, answers: ["a", "b"] })
        .success,
    ).toBe(true);
    expect(questionSchema.safeParse({ ...base, format: "true_false", answer: false }).success).toBe(
      true,
    );
    expect(
      questionSchema.safeParse({ ...base, format: "fib", answers: ["apoptosis"] }).success,
    ).toBe(true);
    expect(
      questionSchema.safeParse({
        ...base,
        format: "saq",
        modelAnswer: "Swelling, blebs…",
        marks: 5,
      }).success,
    ).toBe(true);
  });

  it("carries exam metadata and review flags", () => {
    const q = questionSchema.parse({
      ...base,
      format: "true_false",
      answer: true,
      yearsAsked: [2019, 2023],
      difficulty: "easy",
      flags: { debatable: "Some texts list this as reversible." },
    });
    expect(q.flags?.debatable).toMatch(/reversible/);
  });

  it("rejects an implausible exam year", () => {
    expect(
      questionSchema.safeParse({ ...base, format: "true_false", answer: true, yearsAsked: [1850] })
        .success,
    ).toBe(false);
  });
});
