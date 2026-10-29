import { ForbiddenError, guest } from "@pragya/authz";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { authorizedProcedure, publicProcedure, router } from "./trpc.js";

const testRouter = router({
  leaky: publicProcedure.query(() => {
    throw new Error("Duplicate entry 'x' for key 'batches_institute_name_uq'");
  }),
  denied: publicProcedure.query(() => {
    throw new ForbiddenError("audit.read");
  }),
  scoped: authorizedProcedure(z.string().min(1), "course.read", async ({ input }) => ({
    courseId: input,
    isPublished: true,
    visibility: "public",
  })).query(() => ({ ok: true })),
});

interface TrpcBody {
  readonly result?: { readonly data: unknown };
  readonly error?: { readonly message: string; readonly data: { readonly code: string } };
}

const call = async (path: string, input?: unknown): Promise<{ status: number; body: TrpcBody }> => {
  const query = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(`http://test/trpc/${path}${query}`),
    router: testRouter,
    createContext: () => ({ subject: guest() }),
  });
  return { status: res.status, body: (await res.json()) as TrpcBody };
};

describe("tRPC error shaping", () => {
  it("replaces internal error messages with a generic one", async () => {
    const { status, body } = await call("leaky");
    expect(status).toBe(500);
    expect(body.error?.message).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("batches_institute_name_uq");
  });

  it("maps a ForbiddenError thrown in a resolver to FORBIDDEN", async () => {
    const { status, body } = await call("denied");
    expect(status).toBe(403);
    expect(body.error?.data.code).toBe("FORBIDDEN");
  });

  it("resolves the resource context from the validated input", async () => {
    const { status, body } = await call("scoped", "course_1");
    expect(status).toBe(200);
    expect(body.result?.data).toEqual({ ok: true });
  });
});
