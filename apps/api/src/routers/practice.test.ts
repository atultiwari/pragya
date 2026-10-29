import { guest, user, type Subject } from "@pragya/authz";
import type { AttemptInput, LessonView, StoredQuestion } from "@pragya/db";
import { describe, expect, it } from "vitest";
import { NO_SERVICES, type Services } from "../services.js";
import { createCaller } from "../trpc.js";
import { appRouter } from "./index.js";

const lesson = (isPreview: boolean): LessonView => ({
  id: "lesson-id",
  slug: "necrosis",
  title: "Necrosis",
  isPreview,
  previous: null,
  next: null,
  course: {
    id: "course-id",
    slug: "path",
    title: "Path",
    status: "published",
    visibility: "public",
    instituteId: null,
    pricePaise: 0,
  },
});

const bank: readonly StoredQuestion[] = [
  {
    id: "q1-id",
    slug: "q1",
    lessonIsPreview: true,
    body: {
      id: "q1",
      lessonId: "necrosis",
      format: "mcq",
      stem: "Caseous necrosis is typical of?",
      options: [
        { id: "a", text: "MI" },
        { id: "b", text: "TB" },
      ],
      answer: "b",
      explanation: "Granulomas.",
    },
  },
  { id: "bad-id", slug: "broken", lessonIsPreview: true, body: { id: "broken", format: "mcq" } },
  {
    id: "paid-id",
    slug: "paid-q",
    lessonIsPreview: false,
    body: {
      id: "paid-q",
      lessonId: "paid",
      format: "true_false",
      stem: "Paid stem",
      answer: true,
      explanation: "Paid key",
    },
  },
];

function setup({ isPreview = true, enrolled = false, attemptLimit = 100 } = {}) {
  const attempts: AttemptInput[] = [];
  const poolsAsked: (readonly string[])[] = [];
  const services: Services = {
    ...NO_SERVICES,
    catalogue: {
      ...NO_SERVICES.catalogue,
      getLesson: async (_c, l) => (l === "necrosis" ? lesson(isPreview) : null),
      getLessonBlocks: async () => [
        { type: "paragraph", text: "x" },
        { type: "quiz", poolRef: "necrosis-patterns" },
      ],
    },
    enrollments: {
      ...NO_SERVICES.enrollments,
      isEnrolled: async () => enrolled,
      isInstituteMember: async () => false,
    },
    questions: {
      listPools: async (_courseId, pools) => {
        poolsAsked.push(pools);
        return bank;
      },
      findInPools: async (_courseId, slug, pools) =>
        pools.includes("necrosis-patterns") ? (bank.find((q) => q.slug === slug) ?? null) : null,
      recordAttempt: async (input) => {
        if (attempts.length >= attemptLimit) return false;
        attempts.push(input);
        return true;
      },
    },
  };
  return { services, attempts, poolsAsked };
}

const call = (subject: Subject, services: Services) =>
  createCaller(appRouter)({ subject, services });
const where = { courseSlug: "path", lessonSlug: "necrosis" };

describe("practice.quiz", () => {
  it("returns learner views for the lesson's quiz pool, skipping malformed questions", async () => {
    const { services, poolsAsked } = setup();
    const result = await call(guest(), services).practice.quiz({
      ...where,
      poolRef: "necrosis-patterns",
    });
    expect(poolsAsked).toEqual([["necrosis-patterns"]]);
    expect(result.questions).toEqual([
      {
        id: "q1",
        format: "mcq",
        stem: "Caseous necrosis is typical of?",
        options: [
          { id: "a", text: "MI" },
          { id: "b", text: "TB" },
        ],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("Granulomas");
  });

  it("leaves out pooled questions from lessons the caller cannot read", async () => {
    const { services } = setup();
    const result = await call(guest(), services).practice.quiz({
      ...where,
      poolRef: "necrosis-patterns",
    });
    expect(JSON.stringify(result)).not.toContain("Paid stem");
  });

  it("includes them for an enrolled learner", async () => {
    const { services } = setup({ enrolled: true });
    const result = await call(user("u1"), services).practice.quiz({
      ...where,
      poolRef: "necrosis-patterns",
    });
    expect(result.questions.map((q) => q.id)).toEqual(["q1", "paid-q"]);
  });

  it("refuses a pool that the lesson does not embed", async () => {
    const { services } = setup();
    await expect(
      call(guest(), services).practice.quiz({ ...where, poolRef: "other-pool" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("follows the lesson's access rule", async () => {
    const { services } = setup({ isPreview: false });
    await expect(
      call(user("u1"), services).practice.quiz({ ...where, poolRef: "necrosis-patterns" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "ENROLMENT_REQUIRED",
    });
  });
});

describe("practice.answer", () => {
  it("scores server-side, reveals the key, and records the attempt for a signed-in learner", async () => {
    const { services, attempts } = setup();
    const result = await call(user("u1"), services).practice.answer({
      ...where,
      questionId: "q1",
      response: { choice: "a" },
    });
    expect(result).toEqual({ correct: false, key: { choice: "b" }, explanation: "Granulomas." });
    expect(attempts).toEqual([
      {
        userId: "u1",
        questionId: "q1-id",
        courseId: "course-id",
        isCorrect: false,
        response: { choice: "a" },
      },
    ]);
  });

  it("scores a guest's answer without recording it", async () => {
    const { services, attempts } = setup();
    const result = await call(guest(), services).practice.answer({
      ...where,
      questionId: "q1",
      response: { choice: "b" },
    });
    expect(result.correct).toBe(true);
    expect(attempts).toEqual([]);
  });

  it("rejects a response that does not fit the question", async () => {
    const { services } = setup();
    await expect(
      call(guest(), services).practice.answer({
        ...where,
        questionId: "q1",
        response: { choice: "z" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("will not reveal the key of a question from a lesson the caller cannot read", async () => {
    const { services } = setup();
    await expect(
      call(guest(), services).practice.answer({
        ...where,
        questionId: "paid-q",
        response: { value: false },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("slows down a learner who answers too fast", async () => {
    const { services } = setup({ attemptLimit: 0 });
    await expect(
      call(user("u1"), services).practice.answer({
        ...where,
        questionId: "q1",
        response: { choice: "b" },
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("refuses a question outside the lesson's pools", async () => {
    const base = setup().services;
    const services: Services = {
      ...base,
      questions: { ...base.questions, findInPools: async () => null },
    };
    await expect(
      call(guest(), services).practice.answer({
        ...where,
        questionId: "q1",
        response: { choice: "b" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses answers on a locked lesson", async () => {
    const { services, attempts } = setup({ isPreview: false });
    await expect(
      call(user("u1"), services).practice.answer({
        ...where,
        questionId: "q1",
        response: { choice: "b" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(attempts).toEqual([]);
  });
});
