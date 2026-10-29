import { guest, user, type Subject } from "@pragya/authz";
import type { CourseOutline, CoursePage, EnrolInput, EnrolOutcome, LessonView } from "@pragya/db";
import { describe, expect, it } from "vitest";
import { NO_SERVICES, type Services } from "../services.js";
import { createCaller } from "../trpc.js";
import { appRouter } from "./index.js";

const outline = (overrides: Partial<CourseOutline> = {}): CourseOutline => ({
  id: "course_1",
  slug: "pathology",
  title: "Pathology",
  summary: "S",
  pricePaise: 0,
  language: "en",
  status: "published",
  visibility: "public",
  instituteId: null,
  stream: { slug: "mbbs", name: "MBBS" },
  modules: [
    {
      slug: "m1",
      title: "M1",
      lessons: [{ id: "l1", slug: "intro", title: "Intro", isPreview: true }],
    },
  ],
  ...overrides,
});

const lessonOf = (course: CourseOutline, isPreview: boolean): LessonView => ({
  id: "l2",
  slug: "deep",
  title: "Deep",
  isPreview,
  previous: { slug: "intro", title: "Intro" },
  next: null,
  course: {
    id: course.id,
    slug: course.slug,
    title: course.title,
    status: course.status,
    visibility: course.visibility,
    instituteId: course.instituteId,
    pricePaise: course.pricePaise,
  },
});

interface FakeOptions {
  readonly course?: CourseOutline | null;
  readonly lessonPreview?: boolean;
  readonly enrolled?: boolean;
  readonly member?: boolean;
  readonly outcome?: EnrolOutcome;
}

function fakeServices({
  course = outline(),
  lessonPreview = false,
  enrolled = false,
  member = false,
  outcome = "created",
}: FakeOptions = {}) {
  const enrolments: EnrolInput[] = [];
  const bodyReads: string[] = [];
  const page: CoursePage = { items: [], total: 0, page: 1, pageSize: 20 };
  const services: Services = {
    catalogue: {
      listCourses: async (query) => ({ ...page, page: query.page, pageSize: query.pageSize }),
      getCourse: async () => course,
      getLesson: async () => (course ? lessonOf(course, lessonPreview) : null),
      getLessonBlocks: async () => {
        bodyReads.push("l2");
        return [{ type: "paragraph", text: "Body" }];
      },
      getFigureUse: async () => null,
    },
    enrollments: {
      isEnrolled: async () => enrolled,
      enrol: async (input) => {
        enrolments.push(input);
        return outcome;
      },
      isInstituteMember: async () => member,
    },
    questions: NO_SERVICES.questions,
  };
  return { services, enrolments, bodyReads };
}

const call = (subject: Subject, services: Services) =>
  createCaller(appRouter)({ subject, services });
const learner = user("u_1");

describe("catalogue.listCourses", () => {
  it("passes validated paging to the repository", async () => {
    const { services } = fakeServices();
    expect(
      await call(guest(), services).catalogue.listCourses({ page: 2, pageSize: 5 }),
    ).toMatchObject({ page: 2, pageSize: 5 });
  });

  it("caps the page size", async () => {
    const { services } = fakeServices();
    await expect(
      call(guest(), services).catalogue.listCourses({ pageSize: 500 }),
    ).rejects.toThrow();
  });
});

describe("catalogue.course", () => {
  it("returns a published course with the caller's access", async () => {
    const { services } = fakeServices({ enrolled: true });
    const result = await call(learner, services).catalogue.course({ slug: "pathology" });
    expect(result).toMatchObject({
      slug: "pathology",
      access: { enrolled: true, canEnrolFree: false },
    });
  });

  it("does not expose internal lesson ids in the outline", async () => {
    const { services } = fakeServices();
    const result = await call(guest(), services).catalogue.course({ slug: "pathology" });
    expect(result.modules[0]?.lessons[0]).toEqual({
      slug: "intro",
      title: "Intro",
      isPreview: true,
    });
  });

  it("offers free enrolment to a signed-in learner who is not enrolled", async () => {
    const { services } = fakeServices();
    const result = await call(learner, services).catalogue.course({ slug: "pathology" });
    expect(result.access).toEqual({ enrolled: false, canEnrolFree: true });
  });

  it.each([
    ["missing", null],
    ["a draft", outline({ status: "draft" })],
    ["institute-only for an outsider", outline({ visibility: "institute", instituteId: "inst_1" })],
  ])("hides %s course as NOT_FOUND", async (_label, course) => {
    const { services } = fakeServices({ course });
    await expect(
      call(learner, services).catalogue.course({ slug: "pathology" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("shows an institute-only course to a member of that institute", async () => {
    const { services } = fakeServices({
      course: outline({ visibility: "institute", instituteId: "inst_1" }),
      member: true,
    });
    expect(await call(learner, services).catalogue.course({ slug: "pathology" })).toMatchObject({
      slug: "pathology",
    });
  });
});

describe("catalogue.lesson", () => {
  it("lets a guest read a preview lesson", async () => {
    const { services } = fakeServices({ lessonPreview: true });
    const lesson = await call(guest(), services).catalogue.lesson({
      courseSlug: "pathology",
      lessonSlug: "deep",
    });
    expect(lesson).toMatchObject({ slug: "deep", blocks: [{ type: "paragraph", text: "Body" }] });
  });

  it("asks an unenrolled learner to enrol, without reading the body", async () => {
    const { services, bodyReads } = fakeServices();
    await expect(
      call(learner, services).catalogue.lesson({ courseSlug: "pathology", lessonSlug: "deep" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "ENROLMENT_REQUIRED" });
    expect(bodyReads).toEqual([]);
  });

  it("lets an enrolled learner read a paid lesson", async () => {
    const { services } = fakeServices({ enrolled: true });
    const lesson = await call(learner, services).catalogue.lesson({
      courseSlug: "pathology",
      lessonSlug: "deep",
    });
    expect(lesson.next).toBeNull();
  });

  it("hides lessons of an unpublished course", async () => {
    const { services } = fakeServices({
      course: outline({ status: "draft" }),
      lessonPreview: true,
    });
    await expect(
      call(guest(), services).catalogue.lesson({ courseSlug: "pathology", lessonSlug: "deep" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("enrollment.enrolFree", () => {
  it("enrols a signed-in learner in a free course", async () => {
    const { services, enrolments } = fakeServices();
    expect(await call(learner, services).enrollment.enrolFree({ courseSlug: "pathology" })).toEqual(
      { enrolled: true },
    );
    expect(enrolments).toEqual([{ userId: "u_1", courseId: "course_1", source: "free" }]);
  });

  it("reports a revoked enrolment instead of pretending to enrol", async () => {
    const { services } = fakeServices({ outcome: "revoked" });
    await expect(
      call(learner, services).enrollment.enrolFree({ courseSlug: "pathology" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "ENROLMENT_REVOKED",
    });
  });

  it("requires sign-in", async () => {
    const { services } = fakeServices();
    await expect(
      call(guest(), services).enrollment.enrolFree({ courseSlug: "pathology" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("refuses a paid course", async () => {
    const { services, enrolments } = fakeServices({ course: outline({ pricePaise: 49900 }) });
    await expect(
      call(learner, services).enrollment.enrolFree({ courseSlug: "pathology" }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(enrolments).toEqual([]);
  });

  it("refuses a course the learner cannot see", async () => {
    const { services } = fakeServices({ course: outline({ status: "draft" }) });
    await expect(
      call(learner, services).enrollment.enrolFree({ courseSlug: "pathology" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
