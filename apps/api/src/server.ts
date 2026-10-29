import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import type { Server } from "node:http";
import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyHttpOptions,
  type FastifyInstance,
} from "fastify";
import { registerAuthRoutes, type AuthHandler } from "./auth-route.js";
import { registerContentRoutes } from "./content-route.js";
import { guestResolver, toWebHeaders, type SubjectResolver } from "./context.js";
import { NO_SERVICES, type Services } from "./services.js";
import type { Env } from "./env.js";
import { requestSerializer } from "./logging.js";
import { appRouter, type AppRouter } from "./routers/index.js";

export interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

/** Caps calls per batched request so one HTTP request cannot fan out without limit. */
const MAX_TRPC_BATCH = 10;

const ok = <T>(data: T): ApiEnvelope<T> => ({ success: true, data, error: null });
const fail = (error: string): ApiEnvelope<never> => ({ success: false, data: null, error });

const httpError = (statusCode: number, message: string): FastifyError =>
  Object.assign(new Error(message), { statusCode, code: "HTTP_ERROR", name: "HttpError" });

export interface ServerDeps {
  /** Works out who is calling; defaults to treating everyone as a guest. */
  readonly resolveSubject?: SubjectResolver;
  /** Better Auth's handler; /api/auth/* is mounted only when provided. */
  readonly authHandler?: AuthHandler;
  /** Repositories used by procedures; without them, data procedures fail with a 500. */
  readonly services?: Services;
  /** Folder of imported pack figures; /content/* is mounted only when provided. */
  readonly contentAssetsDir?: string;
  /** Shared logger, so auth and the server log through one pino instance. */
  readonly logger?: FastifyBaseLogger;
}

export async function buildServer(env: Env, deps: ServerDeps = {}): Promise<FastifyInstance> {
  const resolveSubject = deps.resolveSubject ?? guestResolver;
  const options: FastifyHttpOptions<Server> = {
    ...(deps.logger
      ? { loggerInstance: deps.logger }
      : { logger: { level: env.LOG_LEVEL, serializers: { req: requestSerializer } } }),
    // Trust only the configured number of proxy hops; with 0, X-Forwarded-For is ignored.
    trustProxy: (_address, hop) => hop < env.TRUST_PROXY_HOPS,
    // tRPC puts procedure paths in the URL; batched calls exceed Fastify's 100-char default.
    routerOptions: { maxParamLength: 5000 },
  };
  const app = Fastify(options);

  await app.register(helmet);
  await app.register(cors, {
    origin: env.WEB_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_PER_MINUTE,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) =>
      httpError(context.statusCode, `Too many requests, retry in ${context.after}`),
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) request.log.error({ err: error }, "Unhandled API error");
    return reply
      .status(statusCode)
      .send(fail(statusCode >= 500 ? "Internal server error" : error.message));
  });
  app.setNotFoundHandler((_request, reply) => reply.status(404).send(fail("Not found")));

  app.get("/health", () => ok({ status: "ok" }));

  if (deps.authHandler) registerAuthRoutes(app, deps.authHandler, env.AUTH_RATE_LIMIT_PER_MINUTE);
  if (deps.contentAssetsDir) {
    await registerContentRoutes(app, {
      assetsDir: deps.contentAssetsDir,
      services: deps.services ?? NO_SERVICES,
      resolveSubject,
    });
  }

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      maxBatchSize: MAX_TRPC_BATCH,
      createContext: async ({ req }) => ({
        subject: await resolveSubject(toWebHeaders(req.headers)),
        services: deps.services ?? NO_SERVICES,
      }),
      onError: ({ error, path, req }) => {
        if (error.code === "INTERNAL_SERVER_ERROR")
          req.log.error({ err: error, path }, "tRPC error");
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  return app;
}
