import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client.js";
import { runMigrations } from "../migrate.js";
import {
  batchMembers,
  batches,
  courses,
  enrollments,
  institutes,
  streams,
  users,
} from "../schema/index.js";
import { createCatalogueRepository } from "./catalogue.js";
import { importCourse } from "./course-import.js";
import { createEnrollmentRepository } from "./enrollments.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!DATABASE_URL)("catalogue and enrolments against MySQL", () => {
  let handle: DbHandle;
  const tag = ulid().toLowerCase();
  const streamSlug = `cat-${tag}`;
  const publicSlug = `pub-${tag}`;
  const paidSlug = `paid-${tag}`;
  const draftSlug = `draft-${tag}`;
  const instituteSlug = `inst-course-${tag}`;
  const instituteId = ulid();
  const userId = ulid();

  const lessons = [
    {
      slug: "intro",
      moduleSlug: "m1",
      title: "Intro",
      position: 1,
      isPreview: true,
      blocks: [{ type: "figure", src: "figures/shared_1.svg", alt: "Shared" }],
    },
    {
      slug: "deep",
      moduleSlug: "m1",
      title: "Deep",
      position: 2,
      isPreview: false,
      blocks: [
        { type: "paragraph", text: "Deep" },
        { type: "figure", src: "figures/shared_1.svg", alt: "Shared" },
        { type: "figure", src: "figures/paid%.svg", alt: "Paid" },
      ],
    },
    { slug: "end", moduleSlug: "m2", title: "End", position: 1, isPreview: false, blocks: [] },
  ];

  const importPack = (slug: string, publish: boolean, pricePaise = 0) =>
    importCourse(handle.db, {
      slug,
      title: `Course ${slug}`,
      summary: "Summary",
      streamSlug,
      language: "en",
      pricePaise,
      visibility: "public",
      contentVersion: "1.0.0",
      contentChecksum: "b".repeat(64),
      publish,
      modules: [
        { slug: "m1", title: "Module one", position: 1 },
        { slug: "m2", title: "Module two", position: 2 },
      ],
      lessons,
    });

  beforeAll(async () => {
    handle = createDb(DATABASE_URL ?? "");
    await runMigrations(handle);
    await handle.db.insert(streams).values({ name: "Catalogue stream", slug: streamSlug });
    await importPack(publicSlug, true);
    await importPack(paidSlug, true, 49900);
    await importPack(draftSlug, false);
    const [stream] = await handle.db.select().from(streams).where(eq(streams.slug, streamSlug));
    await handle.db.insert(institutes).values({ id: instituteId, name: "Inst", slug: `i-${tag}` });
    await handle.db.insert(courses).values({
      streamId: stream?.id ?? "",
      instituteId,
      title: "Institute only",
      slug: instituteSlug,
      visibility: "institute",
      status: "published",
    });
    await handle.db
      .insert(users)
      .values({ id: userId, name: "Learner", email: `${tag}@example.test` });
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("lists only published, publicly listed courses, with stream and lesson counts", async () => {
    const page = await createCatalogueRepository(handle.db).listCourses({
      streamSlug,
      page: 1,
      pageSize: 10,
    });
    expect(page.total).toBe(2);
    expect(page.items.map((c) => c.slug).sort()).toEqual([paidSlug, publicSlug].sort());
    expect(page.items.find((c) => c.slug === publicSlug)).toMatchObject({
      title: `Course ${publicSlug}`,
      pricePaise: 0,
      lessonCount: 3,
      stream: { slug: streamSlug, name: "Catalogue stream" },
    });
  });

  it("paginates", async () => {
    const repo = createCatalogueRepository(handle.db);
    const first = await repo.listCourses({ streamSlug, page: 1, pageSize: 1 });
    const second = await repo.listCourses({ streamSlug, page: 2, pageSize: 1 });
    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(first.items[0]?.slug).not.toBe(second.items[0]?.slug);
  });

  it("returns a course outline in module and lesson order", async () => {
    const outline = await createCatalogueRepository(handle.db).getCourse(publicSlug);
    expect(
      outline?.modules.map((m) => [m.slug, m.lessons.map((l) => [l.slug, l.isPreview])]),
    ).toEqual([
      [
        "m1",
        [
          ["intro", true],
          ["deep", false],
        ],
      ],
      ["m2", [["end", false]]],
    ]);
    expect(outline).toMatchObject({ status: "published", visibility: "public", instituteId: null });
  });

  it("returns null for an unknown course", async () => {
    expect(await createCatalogueRepository(handle.db).getCourse("no-such-course")).toBeNull();
  });

  it("returns lesson metadata first and the body only on request", async () => {
    const repo = createCatalogueRepository(handle.db);
    const lesson = await repo.getLesson(publicSlug, "deep");
    expect(lesson).not.toHaveProperty("blocks");
    expect(await repo.getLessonBlocks(lesson?.id ?? "")).toHaveLength(3);
    expect(lesson).toMatchObject({
      slug: "deep",
      title: "Deep",
      isPreview: false,
      previous: { slug: "intro", title: "Intro" },
      next: { slug: "end", title: "End" },
      course: { slug: publicSlug, status: "published", visibility: "public", pricePaise: 0 },
    });
    expect(await createCatalogueRepository(handle.db).getLesson(publicSlug, "nope")).toBeNull();
  });

  it("finds which lessons use a figure, treating % and _ literally", async () => {
    const repo = createCatalogueRepository(handle.db);
    const shared = await repo.getFigureUse(publicSlug, "figures/shared_1.svg");
    expect(shared?.lessons.map((l) => l.isPreview).sort()).toEqual([false, true]);
    expect(shared?.course).toMatchObject({ slug: publicSlug, status: "published" });
    expect((await repo.getFigureUse(publicSlug, "figures/paid%.svg"))?.lessons).toEqual([
      { isPreview: false },
    ]);
    expect((await repo.getFigureUse(publicSlug, "figures/sharedX1.svg"))?.lessons).toEqual([]);
    expect((await repo.getFigureUse(publicSlug, "figures/paid.svg"))?.lessons).toEqual([]);
    expect(await repo.getFigureUse("no-such-course", "figures/shared_1.svg")).toBeNull();
  });

  it("enrols once, idempotently, and reports active enrolment", async () => {
    const repo = createEnrollmentRepository(handle.db);
    const outline = await createCatalogueRepository(handle.db).getCourse(publicSlug);
    const courseId = outline?.id ?? "";
    expect(await repo.isEnrolled(userId, courseId)).toBe(false);
    expect(await repo.enrol({ userId, courseId, source: "free" })).toBe("created");
    expect(await repo.enrol({ userId, courseId, source: "free" })).toBe("existing");
    expect(await repo.isEnrolled(userId, courseId)).toBe(true);
  });

  it("reactivates an expired enrolment but never a revoked one", async () => {
    const repo = createEnrollmentRepository(handle.db);
    const courseId = (await createCatalogueRepository(handle.db).getCourse(paidSlug))?.id ?? "";
    const expiredUser = ulid();
    const revokedUser = ulid();
    await handle.db.insert(users).values([
      { id: expiredUser, name: "Expired", email: `${expiredUser}@example.test` },
      { id: revokedUser, name: "Revoked", email: `${revokedUser}@example.test` },
    ]);
    await handle.db.insert(enrollments).values([
      { userId: expiredUser, courseId, source: "free", expiresAt: new Date(Date.now() - 1000) },
      { userId: revokedUser, courseId, source: "purchase", status: "revoked" },
    ]);
    expect(await repo.enrol({ userId: expiredUser, courseId, source: "free" })).toBe("reactivated");
    expect(await repo.isEnrolled(expiredUser, courseId)).toBe(true);
    expect(await repo.enrol({ userId: revokedUser, courseId, source: "free" })).toBe("revoked");
    expect(await repo.isEnrolled(revokedUser, courseId)).toBe(false);
  });

  it("knows institute membership through batches", async () => {
    const repo = createEnrollmentRepository(handle.db);
    expect(await repo.isInstituteMember(userId, instituteId)).toBe(false);
    const batchId = ulid();
    await handle.db.insert(batches).values({ id: batchId, instituteId, name: "Batch" });
    await handle.db.insert(batchMembers).values({ batchId, instituteId, userId });
    expect(await repo.isInstituteMember(userId, instituteId)).toBe(true);
  });
});
