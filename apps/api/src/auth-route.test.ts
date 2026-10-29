import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "./env.js";
import { buildServer } from "./server.js";

const env = parseEnv({ LOG_LEVEL: "silent", AUTH_RATE_LIMIT_PER_MINUTE: "2" });

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const withHandler = async (handler: (request: Request) => Promise<Response>) => {
  app = await buildServer(env, { authHandler: handler });
  return app;
};

describe("/api/auth/*", () => {
  it("forwards method, URL, headers and JSON body to the auth handler", async () => {
    const handler = vi.fn(
      async (_request: Request) => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const server = await withHandler(handler);
    const res = await server.inject({
      method: "POST",
      url: "/api/auth/sign-in/email?x=1",
      headers: { "content-type": "application/json", cookie: "a=1", host: "api.test" },
      payload: { email: "a@example.test", password: "secret-pass" },
    });
    expect(res.statusCode).toBe(200);
    const forwarded = handler.mock.calls[0]?.[0];
    expect(forwarded?.method).toBe("POST");
    expect(forwarded?.url).toBe("http://api.test/api/auth/sign-in/email?x=1");
    expect(forwarded?.headers.get("cookie")).toBe("a=1");
    expect(await forwarded?.json()).toEqual({ email: "a@example.test", password: "secret-pass" });
  });

  it("replaces client-supplied forwarding headers with the address Fastify trusts", async () => {
    const handler = vi.fn(async (_request: Request) => new Response(null, { status: 204 }));
    const server = await withHandler(handler);
    await server.inject({
      method: "GET",
      url: "/api/auth/get-session",
      remoteAddress: "203.0.113.7",
      headers: { "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8", forwarded: "for=9.9.9.9" },
    });
    const forwarded = handler.mock.calls[0]?.[0];
    expect(forwarded?.headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(forwarded?.headers.has("x-real-ip")).toBe(false);
    expect(forwarded?.headers.has("forwarded")).toBe(false);
  });

  it("returns every Set-Cookie header and the status unchanged", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "a=1; Path=/; HttpOnly");
    headers.append("set-cookie", "b=2; Path=/; HttpOnly");
    headers.set("content-type", "application/json");
    const server = await withHandler(
      async () => new Response('{"error":"nope"}', { status: 401, headers }),
    );
    const res = await server.inject({ method: "GET", url: "/api/auth/get-session" });
    expect(res.statusCode).toBe(401);
    expect(res.headers["set-cookie"]).toEqual(["a=1; Path=/; HttpOnly", "b=2; Path=/; HttpOnly"]);
    expect(res.json()).toEqual({ error: "nope" });
  });

  it("applies a stricter rate limit to auth routes", async () => {
    const server = await withHandler(async () => new Response(null, { status: 204 }));
    await server.inject({ method: "GET", url: "/api/auth/get-session" });
    await server.inject({ method: "GET", url: "/api/auth/get-session" });
    const res = await server.inject({ method: "GET", url: "/api/auth/get-session" });
    expect(res.statusCode).toBe(429);
  });

  it("is not mounted without an auth handler", async () => {
    app = await buildServer(env);
    const res = await app.inject({ method: "GET", url: "/api/auth/get-session" });
    expect(res.statusCode).toBe(404);
  });
});
