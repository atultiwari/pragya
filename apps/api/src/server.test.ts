import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";
import { buildServer } from "./server.js";

const env = parseEnv({ LOG_LEVEL: "silent", RATE_LIMIT_PER_MINUTE: "3" });

let app: FastifyInstance | undefined;
const start = async (): Promise<FastifyInstance> => {
  app = await buildServer(env);
  return app;
};

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const trpcQuery = (path: string, input?: unknown): string =>
  input === undefined
    ? `/trpc/${path}`
    : `/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`;

describe("REST", () => {
  it("reports health in the standard envelope", async () => {
    const res = await (await start()).inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: { status: "ok" }, error: null });
  });

  it("returns a 404 envelope for unknown routes", async () => {
    const res = await (await start()).inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ success: false, data: null, error: "Not found" });
  });

  it("sends security headers", async () => {
    const res = await (await start()).inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("allows the configured web origin only", async () => {
    const server = await start();
    const allowed = await server.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:3000" },
    });
    const denied = await server.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("hides internal error details behind a 500 envelope", async () => {
    const server = await start();
    server.get("/boom", () => {
      throw new Error("db password is hunter2");
    });
    const res = await server.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ success: false, data: null, error: "Internal server error" });
  });

  it("does not let a spoofed X-Forwarded-For dodge the rate limit", async () => {
    const server = await start();
    for (let i = 0; i < 3; i += 1) {
      await server.inject({
        method: "GET",
        url: "/health",
        headers: { "x-forwarded-for": `10.0.0.${i}` },
      });
    }
    const res = await server.inject({
      method: "GET",
      url: "/health",
      headers: { "x-forwarded-for": "10.0.0.99" },
    });
    expect(res.statusCode).toBe(429);
  });

  it("rate-limits with an envelope", async () => {
    const server = await start();
    for (let i = 0; i < 3; i += 1) await server.inject({ method: "GET", url: "/health" });
    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ success: false, data: null });
  });
});

describe("tRPC", () => {
  it("answers health.ping", async () => {
    const res = await (await start()).inject({ method: "GET", url: trpcQuery("health.ping") });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ result: { data: { pong: true } } });
  });

  it("treats an unauthenticated caller as a guest", async () => {
    const res = await (await start()).inject({ method: "GET", url: trpcQuery("me.whoami") });
    expect(res.json()).toEqual({ result: { data: { kind: "guest", roles: [] } } });
  });

  it("lists a guest's permissions for a scope without trusting client-supplied facts", async () => {
    const res = await (
      await start()
    ).inject({
      method: "GET",
      url: trpcQuery("me.permissions", {
        instituteId: "inst_a",
        isPublished: true,
        isPreview: true,
      }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ result: { data: { actions: [] } } });
  });

  it("lets a guest call a procedure with no scope", async () => {
    const res = await (await start()).inject({ method: "GET", url: trpcQuery("me.permissions") });
    expect(res.json()).toEqual({ result: { data: { actions: [] } } });
  });

  it("rejects malformed input with BAD_REQUEST", async () => {
    const res = await (
      await start()
    ).inject({
      method: "GET",
      url: trpcQuery("me.permissions", { instituteId: 42 }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.data.code).toBe("BAD_REQUEST");
  });

  it("accepts batches up to the cap and refuses larger ones", async () => {
    const server = await start();
    const batch = (n: number) => Array.from({ length: n }, () => "health.ping").join(",");
    const atCap = await server.inject({ method: "GET", url: `/trpc/${batch(10)}?batch=1` });
    const overCap = await server.inject({ method: "GET", url: `/trpc/${batch(11)}?batch=1` });
    expect(atCap.statusCode).toBe(200);
    expect(overCap.statusCode).toBe(400);
  });

  it("maps ForbiddenError to FORBIDDEN without leaking internals", async () => {
    const res = await (await start()).inject({ method: "GET", url: trpcQuery("admin.ping") });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error.data.code).toBe("FORBIDDEN");
    expect(body.error.data.stack).toBeUndefined();
  });
});
