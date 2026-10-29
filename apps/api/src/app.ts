import { createAuth, createDevSenders, getSessionUserId, parseAuthEnv } from "@pragya/auth";
import { createDb, createRoleAssignmentRepository, type DbHandle } from "@pragya/db";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { createSubjectResolver } from "./context.js";
import type { Env } from "./env.js";
import { buildServer } from "./server.js";

export interface App {
  readonly server: FastifyInstance;
  readonly db: DbHandle;
}

/** Wires the real database, Better Auth and role lookups into the HTTP server. */
export async function createApp(
  env: Env,
  source: Record<string, string | undefined>,
  logger: FastifyBaseLogger,
): Promise<App> {
  if (!env.DATABASE_URL) throw new Error("Invalid environment: DATABASE_URL is required");
  const authEnv = parseAuthEnv(source);
  const db = createDb(env.DATABASE_URL);
  // Real email/SMS providers arrive with the notifications work (D-013); until then startup
  // fails unless log-only senders were explicitly enabled with AUTH_DEV_SENDERS=true.
  const { mailer, sms } = createDevSenders(logger, authEnv.devSenders);
  const auth = createAuth({ db: db.db, env: authEnv, mailer, sms });
  const roles = createRoleAssignmentRepository(db.db);

  const server = await buildServer(env, {
    logger,
    authHandler: (request) => auth.handler(request),
    resolveSubject: createSubjectResolver({
      getUserId: (headers) => getSessionUserId(auth, headers),
      listAssignments: (userId) => roles.listForUser(userId),
    }),
  });
  server.addHook("onClose", () => db.close());
  return { server, db };
}
