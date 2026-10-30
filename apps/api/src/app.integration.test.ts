import {
  createDb,
  createRoleAssignmentRepository,
  importCourse,
  runMigrations,
  schema,
} from "@pragya/db";
import type { FastifyInstance } from "fastify";
import { pino } from "pino";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { parseEnv } from "./env.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;

const source = {
  DATABASE_URL,
  LOG_LEVEL: "silent",
  BETTER_AUTH_SECRET: "api-test-secret-".padEnd(48, "y"),
  BETTER_AUTH_URL: "http://localhost:4000",
  WEB_ORIGIN: "http://localhost:3000",
  AUTH_DEV_SENDERS: "true",
};

const cookiesOf = (setCookie: string | string[] | undefined): string =>
  (Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [])
    .map((c) => c.split(";")[0])
    .join("; ");

describe.skipIf(!DATABASE_URL)("API with Better Auth and MySQL", () => {
  let server: FastifyInstance;
  const streamSlug = `api-${ulid().toLowerCase()}`;
  const courseSlug = `api-course-${ulid().toLowerCase()}`;

  beforeAll(async () => {
    const migrator = createDb(DATABASE_URL ?? "");
    await runMigrations(migrator);
    await migrator.db.insert(schema.streams).values({ name: "API stream", slug: streamSlug });
    await importCourse(migrator.db, {
      slug: courseSlug,
      title: "API course",
      summary: "S",
      streamSlug,
      language: "en",
      pricePaise: 0,
      visibility: "public",
      contentVersion: "1.0.0",
      contentChecksum: "c".repeat(64),
      publish: true,
      modules: [{ slug: "m1", title: "M1", position: 1 }],
      lessons: [
        {
          slug: "intro",
          moduleSlug: "m1",
          title: "Intro",
          position: 1,
          isPreview: true,
          blocks: [],
        },
        {
          slug: "deep",
          moduleSlug: "m1",
          title: "Deep",
          position: 2,
          isPreview: false,
          blocks: [{ type: "paragraph", text: "Paid body" }],
        },
      ],
    });
    await migrator.close();
    ({ server } = await createApp(parseEnv(source), source, pino({ level: "silent" })));
  });

  afterAll(async () => {
    await server?.close();
  });

  const signUp = async () => {
    const email = `${ulid().toLowerCase()}@example.test`;
    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: "http://localhost:3000" },
      payload: { email, password: "a sturdy password", name: "Integration" },
    });
    expect(res.statusCode).toBe(200);
    return {
      userId: (res.json() as { user: { id: string } }).user.id,
      cookie: cookiesOf(res.headers["set-cookie"]),
    };
  };

  const trpc = (path: string, cookie?: string) =>
    server.inject({ method: "GET", url: `/trpc/${path}`, headers: cookie ? { cookie } : {} });

  it("treats a signed-in user as themselves, with no roles yet", async () => {
    const { userId, cookie } = await signUp();
    const res = await trpc("me.whoami", cookie);
    expect(res.json()).toEqual({ result: { data: { kind: "user", userId, roles: [] } } });
  });

  it("applies stored role grants to authorisation", async () => {
    const { userId, cookie } = await signUp();
    expect((await trpc("admin.ping", cookie)).statusCode).toBe(403);

    const db = createDb(DATABASE_URL ?? "");
    await createRoleAssignmentRepository(db.db).grant({
      userId,
      assignment: { role: "superadmin", scope: { type: "platform" } },
    });
    await db.close();

    expect((await trpc("admin.ping", cookie)).statusCode).toBe(200);
  });

  it("rejects sign-up from an untrusted origin", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { origin: "https://evil.example", cookie: "x=1" },
      payload: {
        email: `${ulid().toLowerCase()}@example.test`,
        password: "a sturdy password",
        name: "Evil",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("ignores a forged session cookie", async () => {
    const res = await trpc("me.whoami", "better-auth.session_token=forged.value");
    expect(res.json()).toEqual({ result: { data: { kind: "guest", roles: [] } } });
  });

  it("lets a learner find a free course, enrol, and read a non-preview lesson", async () => {
    const { cookie } = await signUp();
    const lesson = (who?: string) =>
      trpc(
        `catalogue.lesson?input=${encodeURIComponent(JSON.stringify({ courseSlug, lessonSlug: "deep" }))}`,
        who,
      );

    expect((await lesson(cookie)).statusCode).toBe(403);
    const enrol = await server.inject({
      method: "POST",
      url: "/trpc/enrollment.enrolFree",
      headers: { cookie, "content-type": "application/json" },
      payload: { courseSlug },
    });
    expect(enrol.json()).toEqual({ result: { data: { enrolled: true } } });

    const res = await lesson(cookie);
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.json())).toContain("Paid body");
    expect((await lesson()).statusCode).toBe(403);
  });
  it("tracks lesson completion and shows it on the learner's dashboard", async () => {
    const { cookie } = await signUp();
    const post = (path: string, payload: unknown) =>
      server.inject({
        method: "POST",
        url: `/trpc/${path}`,
        headers: { cookie, "content-type": "application/json" },
        payload: payload as object,
      });

    expect((await trpc("dashboard.overview")).statusCode).toBe(401);
    expect(
      (await post("progress.markComplete", { courseSlug, lessonSlug: "deep" })).statusCode,
    ).toBe(403);
    await post("enrollment.enrolFree", { courseSlug });
    const marked = await post("progress.markComplete", { courseSlug, lessonSlug: "intro" });
    expect(marked.json()).toEqual({ result: { data: { completed: true } } });

    const overview = (await trpc("dashboard.overview", cookie)).json() as {
      result: { data: { courses: unknown[]; resume: unknown } };
    };
    expect(overview.result.data.courses).toEqual([
      expect.objectContaining({
        slug: courseSlug,
        lessonsTotal: 2,
        lessonsCompleted: 1,
        nextLesson: { slug: "deep", title: "Deep" },
        practice: null,
      }),
    ]);
    expect(overview.result.data.resume).toEqual({
      courseSlug,
      courseTitle: "API course",
      lessonSlug: "deep",
      lessonTitle: "Deep",
    });
  });
});
