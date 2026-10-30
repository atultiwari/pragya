import { guest, user, type Subject } from "@pragya/authz";
import type { LessonRef, LessonView } from "@pragya/db";
import { describe, expect, it } from "vitest";
import { NO_SERVICES, type Services } from "../services.js";
import { createCaller } from "../trpc.js";
import { appRouter } from "./index.js";

const lesson = (isPreview: boolean, status: "published" | "draft" = "published"): LessonView => ({
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
    status,
    visibility: "public",
    instituteId: null,
    pricePaise: 0,
  },
});

function setup({
  isPreview = false,
  enrolled = true,
  status = "published" as "published" | "draft",
} = {}) {
  const done = new Set<string>();
  const writes: { userId: string; lesson: LessonRef; completed: boolean }[] = [];
  const services: Services = {
    ...NO_SERVICES,
    catalogue: {
      ...NO_SERVICES.catalogue,
      getLesson: async (_c, l) => (l === "necrosis" ? lesson(isPreview, status) : null),
      getLessonBlocks: async () => [],
    },
    enrollments: {
      ...NO_SERVICES.enrollments,
      isEnrolled: async () => enrolled,
      isInstituteMember: async () => false,
    },
    progress: {
      ...NO_SERVICES.progress,
      setComplete: async (userId, ref, completed) => {
        writes.push({ userId, lesson: ref, completed });
        if (completed) done.add(`${userId}:${ref.id}`);
        else done.delete(`${userId}:${ref.id}`);
      },
      isComplete: async (userId, lessonId) => done.has(`${userId}:${lessonId}`),
    },
  };
  return { services, writes };
}

const call = (subject: Subject, services: Services) =>
  createCaller(appRouter)({ subject, services });
const where = { courseSlug: "path", lessonSlug: "necrosis" };

describe("progress.markComplete", () => {
  it("records completion against the lesson's own course, taken from the database", async () => {
    const { services, writes } = setup();
    const learner = call(user("u1"), services);
    expect(await learner.progress.markComplete(where)).toEqual({ completed: true });
    expect(writes).toEqual([
      { userId: "u1", lesson: { id: "lesson-id", courseId: "course-id" }, completed: true },
    ]);
    expect(await learner.progress.lesson(where)).toEqual({ completed: true });
  });

  it("can be undone", async () => {
    const { services } = setup();
    const learner = call(user("u1"), services);
    await learner.progress.markComplete(where);
    expect(await learner.progress.markComplete({ ...where, completed: false })).toEqual({
      completed: false,
    });
    expect(await learner.progress.lesson(where)).toEqual({ completed: false });
  });

  it("requires sign-in", async () => {
    const { services, writes } = setup({ isPreview: true });
    await expect(call(guest(), services).progress.markComplete(where)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(call(guest(), services).progress.lesson(where)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(writes).toEqual([]);
  });

  it("follows the lesson's access rule", async () => {
    const { services, writes } = setup({ enrolled: false });
    await expect(call(user("u1"), services).progress.markComplete(where)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "ENROLMENT_REQUIRED",
    });
    await expect(call(user("u1"), services).progress.lesson(where)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(writes).toEqual([]);
  });

  it("answers NOT_FOUND for a hidden course or a missing lesson", async () => {
    const hidden = setup({ status: "draft" });
    await expect(
      call(user("u1"), hidden.services).progress.markComplete(where),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { services } = setup();
    await expect(
      call(user("u1"), services).progress.markComplete({ ...where, lessonSlug: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(hidden.writes).toEqual([]);
  });

  it("lets a signed-in learner mark a free preview lesson before enrolling", async () => {
    const { services, writes } = setup({ isPreview: true, enrolled: false });
    expect(await call(user("u1"), services).progress.markComplete(where)).toEqual({
      completed: true,
    });
    expect(writes).toHaveLength(1);
  });

  it("validates input", async () => {
    const { services } = setup();
    await expect(
      call(user("u1"), services).progress.markComplete({ ...where, lessonSlug: "Bad Slug!" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
