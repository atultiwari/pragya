import { guest, user, type Subject } from "@pragya/authz";
import type { FigureUse } from "@pragya/db";
import type { FastifyInstance } from "fastify";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";
import { buildServer } from "./server.js";
import { NO_SERVICES, type Services } from "./services.js";

const env = parseEnv({ LOG_LEVEL: "silent" });
const course: FigureUse["course"] = {
  id: "c1",
  slug: "path",
  title: "Pathology",
  status: "published",
  visibility: "public",
  instituteId: null,
  pricePaise: 0,
};

let assetsDir: string;
let app: FastifyInstance | undefined;

const figureUses: Record<string, readonly { isPreview: boolean }[]> = {
  "figures/free.svg": [{ isPreview: true }],
  "figures/paid.png": [{ isPreview: false }],
  "figures/both.svg": [{ isPreview: false }, { isPreview: true }],
};

function services(enrolled: boolean, courseOverride: Partial<FigureUse["course"]> = {}): Services {
  return {
    ...NO_SERVICES,
    catalogue: {
      ...NO_SERVICES.catalogue,
      getFigureUse: async (slug, src) =>
        slug === "path"
          ? { course: { ...course, ...courseOverride }, lessons: figureUses[src] ?? [] }
          : null,
    },
    enrollments: {
      ...NO_SERVICES.enrollments,
      isEnrolled: async () => enrolled,
      isInstituteMember: async () => false,
    },
  };
}

const start = async (subject: Subject, svc: Services) => {
  app = await buildServer(env, {
    services: svc,
    resolveSubject: async () => subject,
    contentAssetsDir: assetsDir,
  });
  return app;
};

beforeEach(async () => {
  assetsDir = await mkdtemp(join(tmpdir(), "pragya-api-assets-"));
  await mkdir(join(assetsDir, "path/figures"), { recursive: true });
  await writeFile(join(assetsDir, "path/figures/free.svg"), "<svg/>");
  await writeFile(join(assetsDir, "path/figures/both.svg"), "<svg/>");
  await writeFile(join(assetsDir, "path/figures/paid.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(assetsDir, { recursive: true, force: true });
});

describe("GET /content/:course/*", () => {
  it("serves a preview lesson's figure to a guest, sandboxed and cacheable only privately", async () => {
    const res = await (
      await start(guest(), services(false))
    ).inject({ url: "/content/path/figures/free.svg" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/svg+xml");
    expect(res.headers["content-security-policy"]).toContain("sandbox");
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-site");
    expect(res.headers["cache-control"]).toBe("private, max-age=300");
    expect(res.body).toBe("<svg/>");
  });

  it("serves a figure shared with a preview lesson", async () => {
    const res = await (
      await start(guest(), services(false))
    ).inject({ url: "/content/path/figures/both.svg" });
    expect(res.statusCode).toBe(200);
  });

  it("hides a paid lesson's figure from a guest and from an unenrolled learner", async () => {
    expect(
      (
        await (
          await start(guest(), services(false))
        ).inject({ url: "/content/path/figures/paid.png" })
      ).statusCode,
    ).toBe(404);
    await app?.close();
    expect(
      (
        await (
          await start(user("u1"), services(false))
        ).inject({ url: "/content/path/figures/paid.png" })
      ).statusCode,
    ).toBe(404);
  });

  it("serves a paid lesson's figure to an enrolled learner with the right type", async () => {
    const res = await (
      await start(user("u1"), services(true))
    ).inject({ url: "/content/path/figures/paid.png" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
  });

  it.each([
    "/content/path/figures/unused.svg",
    "/content/other/figures/free.svg",
    "/content/path/..%2F..%2Fetc%2Fpasswd",
    "/content/path/figures/script.js",
    "/content/BAD/figures/free.svg",
  ])("returns 404 for %s", async (url) => {
    expect((await (await start(user("u1"), services(true))).inject({ url })).statusCode).toBe(404);
  });

  it("returns 404 for a figure of an unpublished course", async () => {
    const res = await (
      await start(guest(), services(false, { status: "draft" }))
    ).inject({ url: "/content/path/figures/free.svg" });
    expect(res.statusCode).toBe(404);
  });

  it("refuses a file that resolves outside the assets folder", async () => {
    const outside = await mkdtemp(join(tmpdir(), "pragya-outside-"));
    try {
      await writeFile(join(outside, "x.svg"), "<svg>secret</svg>");
      await rm(join(assetsDir, "path/figures/free.svg"));
      await symlink(join(outside, "x.svg"), join(assetsDir, "path/figures/free.svg"));
      expect(
        (
          await (
            await start(guest(), services(false))
          ).inject({ url: "/content/path/figures/free.svg" })
        ).statusCode,
      ).toBe(404);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("is not mounted without an assets folder", async () => {
    app = await buildServer(env, { services: services(true) });
    expect((await app.inject({ url: "/content/path/figures/free.svg" })).statusCode).toBe(404);
  });
});
