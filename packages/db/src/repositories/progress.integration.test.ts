import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client.js";
import { runMigrations } from "../migrate.js";
import {
  batches,
  batchMembers,
  courses,
  enrollments,
  institutes,
  lessonProgress,
  lessons,
  streams,
  users,
} from "../schema/index.js";
import { importCourse, type CourseImport, type QuestionImport } from "./course-import.js";
import { createProgressRepository } from "./progress.js";
import { createQuestionRepository } from "./questions.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;

const tf = (slug: string, lessonSlug: string): QuestionImport => ({
  slug,
  lessonSlug,
  format: "true_false",
  difficulty: null,
  tags: [],
  body: { id: slug, lessonId: lessonSlug, format: "true_false", stem: slug, answer: true },
});

describe.skipIf(!DATABASE_URL)("lesson progress and dashboard queries against MySQL", () => {
  let handle: DbHandle;
  const tag = ulid().toLowerCase();
  const streamSlug = `pg-${tag}`;
  const userId = ulid();
  const otherUserId = ulid();
  const ids: Record<string, string> = {};
  const lessonIds: Record<string, string> = {};

  const pack = (slug: string, title: string, lessonSlugs: string[]): CourseImport => ({
    slug,
    title,
    summary: "S",
    streamSlug,
    language: "en",
    pricePaise: 0,
    visibility: "public",
    contentVersion: "1.0.0",
    contentChecksum: "e".repeat(64),
    publish: true,
    // Two modules, the second listed first, to prove ordering follows positions.
    modules: [
      { slug: "m2", title: "M2", position: 2 },
      { slug: "m1", title: "M1", position: 1 },
    ],
    lessons: lessonSlugs.map((lessonSlug, i) => ({
      slug: lessonSlug,
      moduleSlug: i === 0 ? "m1" : "m2",
      title: lessonSlug.toUpperCase(),
      position: i,
      isPreview: i === 0,
      blocks: [],
    })),
    questions:
      slug.endsWith("-a") && lessonSlugs[0] && lessonSlugs[1]
        ? [tf("qa1", lessonSlugs[0]), tf("qa2", lessonSlugs[1])]
        : [],
  });

  const lessonOf = async (courseId: string, slug: string) => {
    const all = await handle.db
      .select({ id: lessons.id, slug: lessons.slug })
      .from(lessons)
      .where(eq(lessons.courseId, courseId));
    const found = all.find((l) => l.slug === slug);
    if (!found) throw new Error(`no lesson ${slug}`);
    return found.id;
  };

  beforeAll(async () => {
    handle = createDb(DATABASE_URL ?? "");
    await runMigrations(handle);
    await handle.db.insert(streams).values({ name: "PG", slug: streamSlug });
    await handle.db.insert(users).values([
      { id: userId, name: "P", email: `${tag}@example.test` },
      { id: otherUserId, name: "O", email: `o-${tag}@example.test` },
    ]);
    ids.a = (
      await importCourse(handle.db, pack(`pg-${tag}-a`, "Alpha", ["a1", "a2", "a3"]))
    ).courseId;
    ids.b = (await importCourse(handle.db, pack(`pg-${tag}-b`, "Beta", ["b1", "b2"]))).courseId;
    ids.c = (await importCourse(handle.db, pack(`pg-${tag}-c`, "Gamma", ["c1"]))).courseId;
    ids.d = (await importCourse(handle.db, pack(`pg-${tag}-d`, "Delta", ["d1"]))).courseId;
    for (const slug of ["a1", "a2", "a3"]) lessonIds[slug] = await lessonOf(ids.a ?? "", slug);
    for (const slug of ["b1", "b2"]) lessonIds[slug] = await lessonOf(ids.b ?? "", slug);
    await handle.db.insert(enrollments).values([
      { id: ulid(), userId, courseId: ids.a, source: "free" },
      { id: ulid(), userId, courseId: ids.b, source: "free" },
      // Expired and revoked enrolments are not on the dashboard.
      {
        id: ulid(),
        userId,
        courseId: ids.c,
        source: "free",
        expiresAt: new Date(Date.now() - 1000),
      },
      { id: ulid(), userId, courseId: ids.d, source: "free", status: "revoked" },
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("marks a lesson complete idempotently and can undo it", async () => {
    const repo = createProgressRepository(handle.db);
    const a1 = { id: lessonIds.a1 ?? "", courseId: ids.a ?? "" };
    expect(await repo.isComplete(userId, a1.id)).toBe(false);
    await repo.setComplete(userId, a1, true);
    const [first] = await handle.db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId));
    await repo.setComplete(userId, a1, true);
    const rows = await handle.db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId));
    expect(rows).toHaveLength(1);
    // Marking again keeps the first completion time.
    expect(rows[0]?.completedAt).toEqual(first?.completedAt);
    expect(await repo.isComplete(userId, a1.id)).toBe(true);
    expect(await repo.isComplete(otherUserId, a1.id)).toBe(false);

    await repo.setComplete(userId, a1, false);
    expect(await repo.isComplete(userId, a1.id)).toBe(false);
    await repo.setComplete(userId, a1, false);
    expect(await repo.isComplete(userId, a1.id)).toBe(false);
  });

  it("lists only active enrolments, with counts and the next lesson in outline order", async () => {
    const repo = createProgressRepository(handle.db);
    await repo.setComplete(userId, { id: lessonIds.a1 ?? "", courseId: ids.a ?? "" }, true);
    await repo.setComplete(userId, { id: lessonIds.b1 ?? "", courseId: ids.b ?? "" }, true);
    await repo.setComplete(userId, { id: lessonIds.b2 ?? "", courseId: ids.b ?? "" }, true);
    // Another learner's progress never counts.
    await repo.setComplete(otherUserId, { id: lessonIds.a2 ?? "", courseId: ids.a ?? "" }, true);

    const courses = await repo.listEnrolledCourses(userId);
    // Most recently active first: b2 was completed last.
    expect(courses.map((c) => c.course.title)).toEqual(["Beta", "Alpha"]);
    const [beta, alpha] = courses;
    expect(alpha).toMatchObject({
      course: { id: ids.a, slug: `pg-${tag}-a`, status: "published", visibility: "public" },
      lessonsTotal: 3,
      lessonsCompleted: 1,
      nextLesson: { slug: "a2", title: "A2", isPreview: false },
    });
    expect(alpha?.lastActivityAt).toBeInstanceOf(Date);
    expect(beta).toMatchObject({ lessonsTotal: 2, lessonsCompleted: 2, nextLesson: null });
    expect(await repo.listEnrolledCourses(otherUserId)).toEqual([]);
  });

  it("drops unpublished courses and reports institute membership", async () => {
    const learner = ulid();
    await handle.db
      .insert(users)
      .values({ id: learner, name: "I", email: `i-${tag}@example.test` });
    const instituteId = ulid();
    const batchId = ulid();
    await handle.db
      .insert(institutes)
      .values({ id: instituteId, name: "Inst", slug: `inst-${tag}` });
    await handle.db.insert(batches).values({ id: batchId, instituteId, name: "B" });
    await handle.db
      .update(courses)
      .set({ instituteId, visibility: "public_and_institute" })
      .where(eq(courses.id, ids.c ?? ""));
    await handle.db
      .update(courses)
      .set({ status: "archived" })
      .where(eq(courses.id, ids.d ?? ""));
    await handle.db.insert(enrollments).values([
      { id: ulid(), userId: learner, courseId: ids.a ?? "", source: "free" },
      { id: ulid(), userId: learner, courseId: ids.c ?? "", source: "free" },
      { id: ulid(), userId: learner, courseId: ids.d ?? "", source: "free" },
    ]);
    const repo = createProgressRepository(handle.db);
    const before = await repo.listEnrolledCourses(learner);
    expect(before.map((c) => [c.course.title, c.isInstituteMember]).sort()).toEqual([
      ["Alpha", false],
      ["Gamma", false],
    ]);
    await handle.db.insert(batchMembers).values({ batchId, userId: learner, instituteId });
    const after = await repo.listEnrolledCourses(learner);
    expect(after.find((c) => c.course.title === "Gamma")?.isInstituteMember).toBe(true);
    expect(after.find((c) => c.course.title === "Alpha")?.isInstituteMember).toBe(false);
  });

  it("keeps a progress row's course equal to its lesson's course", async () => {
    await expect(
      handle.db.insert(lessonProgress).values({
        id: ulid(),
        userId,
        lessonId: lessonIds.a2 ?? "",
        courseId: ids.b ?? "",
        completedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("uses the enrolment time as last activity before any progress", async () => {
    const fresh = ulid();
    await handle.db.insert(users).values({ id: fresh, name: "F", email: `f-${tag}@example.test` });
    await handle.db
      .insert(enrollments)
      .values({ id: ulid(), userId: fresh, courseId: ids.a ?? "", source: "free" });
    const repo = createProgressRepository(handle.db);
    const [only] = await repo.listEnrolledCourses(fresh);
    expect(only).toMatchObject({
      lessonsCompleted: 0,
      nextLesson: { slug: "a1", isPreview: true },
    });
    expect(only?.lastActivityAt).toEqual(only?.enrolledAt);
  });

  it("computes practice accuracy per course and per lesson from graded attempts", async () => {
    const questions = createQuestionRepository(handle.db, { maxAttemptsPerMinute: 100 });
    const qa1 = await questions.findInPools(ids.a ?? "", "qa1", ["a1"]);
    const qa2 = await questions.findInPools(ids.a ?? "", "qa2", ["a2"]);
    const attempt = (questionId: string, isCorrect: boolean | null, user = userId) =>
      questions.recordAttempt({
        userId: user,
        questionId,
        courseId: ids.a ?? "",
        isCorrect,
        response: {},
      });
    await attempt(qa1?.id ?? "", true);
    await attempt(qa1?.id ?? "", false);
    await attempt(qa1?.id ?? "", null);
    await attempt(qa2?.id ?? "", true);
    await attempt(qa2?.id ?? "", false, otherUserId);

    const repo = createProgressRepository(handle.db);
    const accuracy = await repo.practiceAccuracy(userId, [ids.a ?? "", ids.b ?? ""]);
    expect(accuracy).toEqual([
      {
        courseId: ids.a,
        attempted: 4,
        graded: 3,
        correct: 2,
        lessons: [
          { lessonId: lessonIds.a1, slug: "a1", title: "A1", attempted: 3, graded: 2, correct: 1 },
          { lessonId: lessonIds.a2, slug: "a2", title: "A2", attempted: 1, graded: 1, correct: 1 },
        ],
      },
    ]);
    expect(await repo.practiceAccuracy(userId, [])).toEqual([]);

    // An attempt counts as activity for "continue where you left off".
    const alpha = (await repo.listEnrolledCourses(userId)).find((c) => c.course.id === ids.a);
    expect(alpha?.lastActivityAt.getTime()).toBeGreaterThanOrEqual(Date.now() - 60_000);
  });
});
