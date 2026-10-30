import { permittedActions, type Subject } from "@pragya/authz";
import { z } from "zod";
import { platformProcedure, publicProcedure, router } from "../trpc.js";
import { catalogueRouter } from "./catalogue.js";
import { dashboardRouter } from "./dashboard.js";
import { enrollmentRouter } from "./enrollment.js";
import { practiceRouter } from "./practice.js";
import { progressRouter } from "./progress.js";

/** Only scope identifiers are accepted from clients; facts such as enrolment are resolved server-side. */
const scopeInput = z
  .object({
    instituteId: z.string().min(1).max(26).optional(),
    batchId: z.string().min(1).max(26).optional(),
    courseId: z.string().min(1).max(26).optional(),
  })
  .optional();

const describeSubject = (subject: Subject) =>
  subject.kind === "guest"
    ? { kind: "guest" as const, roles: [] }
    : {
        kind: "user" as const,
        userId: subject.userId,
        roles: subject.assignments.map((a) => a.role),
      };

export const appRouter = router({
  health: router({
    ping: publicProcedure.query(() => ({ pong: true })),
  }),
  me: router({
    whoami: publicProcedure.query(({ ctx }) => describeSubject(ctx.subject)),
    permissions: publicProcedure.input(scopeInput).query(({ ctx, input }) => {
      const scope = Object.fromEntries(
        Object.entries(input ?? {}).filter(([, value]) => value !== undefined),
      );
      return { actions: permittedActions(ctx.subject, scope) };
    }),
  }),
  catalogue: catalogueRouter,
  enrollment: enrollmentRouter,
  practice: practiceRouter,
  progress: progressRouter,
  dashboard: dashboardRouter,
  admin: router({
    ping: platformProcedure("platform.manage").query(() => ({ pong: true })),
  }),
});

export type AppRouter = typeof appRouter;
