import { asc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client.js";
import { runMigrations } from "../migrate.js";
import { courses, institutes, lessons, modules, streams } from "../schema/index.js";
import { importCourse, type CourseImport } from "./course-import.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;

const lesson = (slug: string, moduleSlug: string, position: number, isPreview = false) => ({
  slug,
  moduleSlug,
  title: `Lesson ${slug}`,
  position,
  isPreview,
  blocks: [{ type: "paragraph", text: `Body of ${slug}` }],
});

describe.skipIf(!DATABASE_URL)("importCourse against MySQL", () => {
  let handle: DbHandle;
  const streamSlug = `s-${ulid().toLowerCase()}`;

  const input = (overrides: Partial<CourseImport> = {}): CourseImport => ({
    slug: `c-${ulid().toLowerCase()}`,
    title: "Sample course",
    summary: "Summary",
    streamSlug,
    language: "en",
    pricePaise: 0,
    visibility: "public",
    contentVersion: "1.0.0",
    contentChecksum: "a".repeat(64),
    publish: false,
    modules: [
      { slug: "m1", title: "Module 1", position: 1 },
      { slug: "m2", title: "Module 2", position: 2 },
    ],
    lessons: [lesson("l1", "m1", 1, true), lesson("l2", "m1", 2), lesson("l3", "m2", 1)],
    ...overrides,
  });

  const lessonRows = (courseId: string) =>
    handle.db
      .select({
        id: lessons.id,
        slug: lessons.slug,
        moduleId: lessons.moduleId,
        position: lessons.position,
      })
      .from(lessons)
      .where(eq(lessons.courseId, courseId))
      .orderBy(asc(lessons.slug));

  beforeAll(async () => {
    handle = createDb(DATABASE_URL ?? "");
    await runMigrations(handle);
    await handle.db.insert(streams).values({ name: "Test stream", slug: streamSlug });
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("creates a draft course with its modules and lessons", async () => {
    const data = input();
    const result = await importCourse(handle.db, data);
    expect(result).toMatchObject({ created: true, modules: 2, lessons: 3 });
    const [course] = await handle.db.select().from(courses).where(eq(courses.id, result.courseId));
    expect(course).toMatchObject({
      slug: data.slug,
      status: "draft",
      contentVersion: "1.0.0",
      publishedAt: null,
    });
    expect(await lessonRows(result.courseId)).toHaveLength(3);
  });

  it("re-imports in place: same ids, reordered, moved and removed lessons", async () => {
    const data = input();
    const first = await importCourse(handle.db, data);
    const before = await lessonRows(first.courseId);

    const second = await importCourse(handle.db, {
      ...data,
      contentVersion: "1.1.0",
      modules: [{ slug: "m2", title: "Module 2 renamed", position: 1 }],
      lessons: [lesson("l3", "m2", 1), lesson("l1", "m2", 2)],
    });
    expect(second).toMatchObject({
      courseId: first.courseId,
      created: false,
      modules: 1,
      lessons: 2,
    });

    const after = await lessonRows(first.courseId);
    expect(after.map((l) => l.slug)).toEqual(["l1", "l3"]);
    expect(after.find((l) => l.slug === "l1")?.id).toBe(before.find((l) => l.slug === "l1")?.id);
    const moduleRows = await handle.db
      .select()
      .from(modules)
      .where(eq(modules.courseId, first.courseId));
    expect(moduleRows.map((m) => [m.slug, m.title])).toEqual([["m2", "Module 2 renamed"]]);
    expect(new Set(after.map((l) => l.moduleId))).toEqual(new Set([moduleRows[0]?.id]));
  });

  it("publishes when asked and keeps the first publish date", async () => {
    const data = input({ publish: true });
    const { courseId } = await importCourse(handle.db, data);
    const [first] = await handle.db.select().from(courses).where(eq(courses.id, courseId));
    expect(first?.status).toBe("published");
    await importCourse(handle.db, { ...data, contentVersion: "1.0.1" });
    const [again] = await handle.db.select().from(courses).where(eq(courses.id, courseId));
    expect(again?.status).toBe("published");
    expect(again?.publishedAt).toEqual(first?.publishedAt);
  });

  it("fails without changes when the stream does not exist", async () => {
    await expect(importCourse(handle.db, input({ streamSlug: "no-such-stream" }))).rejects.toThrow(
      /stream "no-such-stream"/,
    );
  });

  it("refuses a lesson that points at a module not in the import", async () => {
    const data = input({ lessons: [lesson("l1", "missing", 1)] });
    await expect(importCourse(handle.db, data)).rejects.toThrow(/module "missing"/);
    expect(await handle.db.select().from(courses).where(eq(courses.slug, data.slug))).toEqual([]);
  });

  it("will not overwrite a course owned by an institute", async () => {
    const instituteId = ulid();
    await handle.db
      .insert(institutes)
      .values({ id: instituteId, name: "Inst", slug: `i-${instituteId.toLowerCase()}` });
    const data = input();
    const [stream] = await handle.db.select().from(streams).where(eq(streams.slug, streamSlug));
    await handle.db.insert(courses).values({
      streamId: stream?.id ?? "",
      instituteId,
      title: "Institute course",
      slug: data.slug,
      visibility: "institute",
    });
    await expect(importCourse(handle.db, data)).rejects.toThrow(/belongs to an institute/);
    const [kept] = await handle.db.select().from(courses).where(eq(courses.slug, data.slug));
    expect(kept?.title).toBe("Institute course");
  });

  it("refuses institute-only visibility for a marketplace import", async () => {
    await expect(importCourse(handle.db, input({ visibility: "institute" }))).rejects.toThrow(
      /institute/,
    );
  });
});
