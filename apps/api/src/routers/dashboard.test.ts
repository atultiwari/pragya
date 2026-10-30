import { guest, user, type Subject } from "@pragya/authz";
import type { CourseAccuracy, EnrolledCourseProgress } from "@pragya/db";
import { describe, expect, it } from "vitest";
import { NO_SERVICES, type Services } from "../services.js";
import { createCaller } from "../trpc.js";
import { accuracyOf } from "./dashboard.js";
import { appRouter } from "./index.js";

const at = (iso: string) => new Date(iso);

type Overrides = Partial<Omit<EnrolledCourseProgress, "course">> & {
  readonly course?: Partial<EnrolledCourseProgress["course"]>;
};

const enrolled = (
  id: string,
  { course, ...overrides }: Overrides = {},
): EnrolledCourseProgress => ({
  enrolledAt: at("2026-10-01T00:00:00Z"),
  isInstituteMember: false,
  lessonsTotal: 3,
  lessonsCompleted: 1,
  nextLesson: { slug: `${id}-2`, title: `${id} two`, isPreview: false },
  lastActivityAt: at("2026-10-02T00:00:00Z"),
  ...overrides,
  course: {
    id: `${id}-id`,
    slug: id,
    title: id.toUpperCase(),
    status: "published",
    visibility: "public",
    instituteId: null,
    ...course,
  },
});

function setup(
  courses: readonly EnrolledCourseProgress[],
  accuracy: readonly CourseAccuracy[] = [],
) {
  const accuracyAsked: (readonly string[])[] = [];
  const services: Services = {
    ...NO_SERVICES,
    // No enrolment fakes: a per-course lookup would throw, proving the dashboard makes none.
    progress: {
      ...NO_SERVICES.progress,
      listEnrolledCourses: async (userId) => (userId === "u1" ? courses : []),
      practiceAccuracy: async (_userId, courseIds) => {
        accuracyAsked.push(courseIds);
        return accuracy.filter((a) => courseIds.includes(a.courseId));
      },
    },
  };
  return { services, accuracyAsked };
}

const call = (subject: Subject, services: Services) =>
  createCaller(appRouter)({ subject, services });

describe("dashboard.overview", () => {
  it("requires sign-in", async () => {
    const { services } = setup([]);
    await expect(call(guest(), services).dashboard.overview()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("is empty for a learner with no enrolments", async () => {
    const { services } = setup([]);
    expect(await call(user("u1"), services).dashboard.overview()).toEqual({
      courses: [],
      resume: null,
    });
  });

  it("summarises each course with practice accuracy and no internal ids", async () => {
    const { services } = setup(
      [enrolled("path")],
      [
        {
          courseId: "path-id",
          attempted: 5,
          graded: 4,
          correct: 3,
          lessons: [
            {
              lessonId: "l1-id",
              slug: "path-1",
              title: "One",
              attempted: 5,
              graded: 4,
              correct: 3,
            },
          ],
        },
      ],
    );
    const result = await call(user("u1"), services).dashboard.overview();
    expect(result.courses).toEqual([
      {
        slug: "path",
        title: "PATH",
        lessonsTotal: 3,
        lessonsCompleted: 1,
        nextLesson: { slug: "path-2", title: "path two" },
        lastActivityAt: "2026-10-02T00:00:00.000Z",
        practice: {
          attempted: 5,
          graded: 4,
          correct: 3,
          accuracy: 0.75,
          lessons: [
            { slug: "path-1", title: "One", attempted: 5, graded: 4, correct: 3, accuracy: 0.75 },
          ],
        },
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("-id");
  });

  it("resumes the most recently active course that still has a lesson to do", async () => {
    const { services } = setup([
      enrolled("done", { nextLesson: null, lastActivityAt: at("2026-10-05T00:00:00Z") }),
      enrolled("recent", { lastActivityAt: at("2026-10-04T00:00:00Z") }),
      enrolled("older", { lastActivityAt: at("2026-10-03T00:00:00Z") }),
    ]);
    const result = await call(user("u1"), services).dashboard.overview();
    expect(result.resume).toEqual({
      courseSlug: "recent",
      courseTitle: "RECENT",
      lessonSlug: "recent-2",
      lessonTitle: "recent two",
    });
    expect(result.courses.map((c) => c.practice)).toEqual([null, null, null]);
  });

  it("leaves out courses the learner may no longer see, and their practice", async () => {
    const { services, accuracyAsked } = setup([
      enrolled("archived", { course: { status: "archived" } }),
      enrolled("institute", { course: { visibility: "institute", instituteId: "inst-1" } }),
      enrolled("member", {
        isInstituteMember: true,
        course: { visibility: "institute", instituteId: "inst-1" },
      }),
      enrolled("visible"),
    ]);
    const result = await call(user("u1"), services).dashboard.overview();
    expect(result.courses.map((c) => c.slug)).toEqual(["member", "visible"]);
    expect(result.resume?.courseSlug).toBe("member");
    expect(accuracyAsked).toEqual([["member-id", "visible-id"]]);
  });
});

describe("accuracyOf", () => {
  it("is null until something has been graded", () => {
    expect(accuracyOf({ attempted: 2, graded: 0, correct: 0 })).toBeNull();
    expect(accuracyOf({ attempted: 3, graded: 3, correct: 1 })).toBeCloseTo(1 / 3);
  });
});
