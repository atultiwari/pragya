import type { FastifyInstance, FastifyRequest } from "fastify";
import { toWebHeaders } from "./context.js";

export type AuthHandler = (request: Request) => Promise<Response>;

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

/** Client-controlled address headers; Better Auth would otherwise trust them for rate limits. */
const FORWARDING_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "cf-connecting-ip",
  "true-client-ip",
];

function trustedHeaders(request: FastifyRequest): Headers {
  const headers = toWebHeaders(request.headers);
  for (const name of FORWARDING_HEADERS) headers.delete(name);
  // request.ip already honours TRUST_PROXY_HOPS.
  headers.set("x-forwarded-for", request.ip);
  return headers;
}

function toWebRequest(request: FastifyRequest): Request {
  const url = new URL(request.url, `${request.protocol}://${request.host}`);
  const hasBody = !BODYLESS_METHODS.has(request.method) && request.body !== undefined;
  return new Request(url, {
    method: request.method,
    headers: trustedHeaders(request),
    ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
  });
}

/** Mounts Better Auth's fetch-style handler at /api/auth/* with its own, stricter rate limit. */
export function registerAuthRoutes(
  app: FastifyInstance,
  handler: AuthHandler,
  perMinute: number,
): void {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } },
    handler: async (request, reply) => {
      const response = await handler(toWebRequest(request));
      reply.status(response.status);
      response.headers.forEach((value, name) => {
        if (name !== "set-cookie") reply.header(name, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);
      return reply.send(response.body === null ? null : await response.text());
    },
  });
}
