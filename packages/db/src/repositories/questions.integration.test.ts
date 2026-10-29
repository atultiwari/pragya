import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client.js";
import { runMigrations } from "../migrate.js";
import { questionAttempts, questions, streams, users } from "../schema/index.js";
import { importCourse, type CourseImport, type QuestionImport } from "./course-import.js";
import { createQuestionRepository } from "./questions.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;

const q = (slug: string, lessonSlug: string, tags: string[] = []): QuestionImport => ({
  slug,
  lessonSlug,
  format: "true_false",
  difficulty: null,
  tags,
  body: {
    id: slug,
    lessonId: lessonSlug,
    format: "true_false",
    stem: `Stem ${slug}`,
    answer: true,
  },
});

describe.skipIf(!DATABASE_URL)("question bank against MySQL", () => {
  let handle: DbHandle;
  let courseId: string;
  const tag = ulid().toLowerCase();
  const streamSlug = `qb-${tag}`;
  const userId = ulid();

  const pack = (questionList: QuestionImport[]): CourseImport => ({
    slug: `qb-course-${tag}`,
    title: "QB",
    summary: "S",
    streamSlug,
    language: "en",
    pricePaise: 0,
    visibility: "public",
    contentVersion: "1.0.0",
    contentChecksum: "d".repeat(64),
    publish: true,
    modules: [{ slug: "m", title: "M", position: 1 }],
    lessons: [
      { slug: "l1", moduleSlug: "m", title: "L1", position: 1, isPreview: true, blocks: [] },
      { slug: "l2", moduleSlug: "m", title: "L2", position: 2, isPreview: false, blocks: [] },
    ],
    questions: questionList,
  });

  beforeAll(async () => {
    handle = createDb(DATABASE_URL ?? "");
    await runMigrations(handle);
    await handle.db.insert(streams).values({ name: "QB", slug: streamSlug });
    await handle.db.insert(users).values({ id: userId, name: "Q", email: `${tag}@example.test` });
    const summary = await importCourse(
      handle.db,
      pack([q("q1", "l1"), q("q2", "l2", ["necrosis"]), q("q3", "l2")]),
    );
    courseId = summary.courseId;
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("imports questions and reports how many", async () => {
    const rows = await handle.db.select().from(questions).where(eq(questions.courseId, courseId));
    expect(rows.map((r) => r.slug).sort()).toEqual(["q1", "q2", "q3"]);
  });

  it("lists a pool by lesson slug or by tag, in a stable order", async () => {
    const repo = createQuestionRepository(handle.db);
    expect((await repo.listPools(courseId, ["l2"])).map((x) => x.slug)).toEqual(["q2", "q3"]);
    expect((await repo.listPools(courseId, ["necrosis"])).map((x) => x.slug)).toEqual(["q2"]);
    expect((await repo.listPools(courseId, ["l1", "necrosis"])).map((x) => x.slug)).toEqual([
      "q1",
      "q2",
    ]);
    expect(await repo.listPools(courseId, ["nothing"])).toEqual([]);
    expect(await repo.listPools(courseId, [])).toEqual([]);
  });

  it("finds a question only when it is in one of the given pools", async () => {
    const repo = createQuestionRepository(handle.db);
    expect(await repo.findInPools(courseId, "q2", ["necrosis"])).toMatchObject({
      slug: "q2",
      body: { stem: "Stem q2" },
    });
    expect(await repo.findInPools(courseId, "q3", ["necrosis"])).toBeNull();
  });

  it("records attempts", async () => {
    const repo = createQuestionRepository(handle.db);
    const found = await repo.findInPools(courseId, "q1", ["l1"]);
    await repo.recordAttempt({
      userId,
      questionId: found?.id ?? "",
      courseId,
      isCorrect: true,
      response: { value: true },
    });
    const rows = await handle.db
      .select()
      .from(questionAttempts)
      .where(eq(questionAttempts.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isCorrect: true, response: { value: true } });
  });

  it("updates in place and removes questions dropped from the pack", async () => {
    const before = await handle.db.select().from(questions).where(eq(questions.courseId, courseId));
    await importCourse(handle.db, pack([{ ...q("q1", "l2"), tags: ["moved"] }]));
    const after = await handle.db.select().from(questions).where(eq(questions.courseId, courseId));
    expect(after.map((r) => r.slug)).toEqual(["q1"]);
    expect(after[0]?.id).toBe(before.find((r) => r.slug === "q1")?.id);
    expect(after[0]?.tags).toEqual(["moved"]);
  });

  it("rejects a question pointing at an unknown lesson", async () => {
    await expect(importCourse(handle.db, pack([q("bad", "no-lesson")]))).rejects.toThrow(
      /question "bad".*"no-lesson"/,
    );
  });

  it("stops recording after the per-minute attempt limit", async () => {
    const repo = createQuestionRepository(handle.db, { maxAttemptsPerMinute: 2 });
    const busyUser = ulid();
    await handle.db
      .insert(users)
      .values({ id: busyUser, name: "Busy", email: `${busyUser}@example.test` });
    const found = await repo.findInPools(courseId, "q1", ["l2", "l1"]);
    const attempt = {
      userId: busyUser,
      questionId: found?.id ?? "",
      courseId,
      isCorrect: false,
      response: {},
    };
    expect([
      await repo.recordAttempt(attempt),
      await repo.recordAttempt(attempt),
      await repo.recordAttempt(attempt),
    ]).toEqual([true, true, false]);
  });
});
