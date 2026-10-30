import { ForbiddenError, assertCan, type Action, type ResourceContext } from "@pragya/authz";
import { TRPCError, initTRPC } from "@trpc/server";
import type { z } from "zod";
import type { RequestContext } from "./context.js";

const INTERNAL_MESSAGE = "Internal server error";

const t = initTRPC.context<RequestContext>().create({
  // isDev: false keeps stack traces out of every response, including in tests.
  isDev: false,
  // Driver and library messages can carry SQL or secrets; only deliberate errors keep theirs.
  errorFormatter: ({ shape, error }) =>
    error.code === "INTERNAL_SERVER_ERROR" ? { ...shape, message: INTERNAL_MESSAGE } : shape,
});

export const router = t.router;

/** Calls procedures in-process (tests, server-side jobs) with a prepared context. */
export const createCaller = t.createCallerFactory;

/** Turns an authz denial anywhere in the chain into a 403 instead of a 500. */
const mapForbidden = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof ForbiddenError) {
    throw new TRPCError({ code: "FORBIDDEN", message: result.error.cause.message });
  }
  return result;
});

export const publicProcedure = t.procedure.use(mapForbidden);

type MaybePromise<T> = T | Promise<T>;

export interface ResolveArgs<TInput> {
  readonly ctx: RequestContext;
  readonly input: TInput;
}

/**
 * A procedure that validates `schema`, then requires `action` on the resource that `resolve`
 * loads from trusted data (database, session) using the validated input.
 */
export const authorizedProcedure = <TSchema extends z.ZodType>(
  schema: TSchema,
  action: Action,
  resolve: (args: ResolveArgs<z.infer<TSchema>>) => MaybePromise<ResourceContext>,
) =>
  publicProcedure.input(schema).use(async ({ ctx, input, next }) => {
    assertCan(ctx.subject, action, await resolve({ ctx, input: input as z.infer<TSchema> }));
    return next();
  });

/** A no-input procedure that requires a platform-level `action`. */
export const platformProcedure = (action: Action) =>
  publicProcedure.use(({ ctx, next }) => {
    assertCan(ctx.subject, action, {});
    return next();
  });

/** Requires a signed-in caller and exposes their user id; guests get UNAUTHORIZED. */
export const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.subject.kind !== "user") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to continue" });
  }
  return next({ ctx: { ...ctx, userId: ctx.subject.userId } });
});
