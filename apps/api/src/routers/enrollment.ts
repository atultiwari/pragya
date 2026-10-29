import { can } from "@pragya/authz";
import { slugSchema } from "@pragya/content";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../trpc.js";
import { courseFacts } from "./facts.js";

export const enrollmentRouter = router({
  /** Free courses only; paid enrolment goes through Razorpay checkout (Phase 1 payments). */
  enrolFree: publicProcedure
    .input(z.object({ courseSlug: slugSchema }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.subject.kind !== "user")
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to enrol" });
      const course = await ctx.services.catalogue.getCourse(input.courseSlug);
      if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      const facts = await courseFacts(ctx.subject, ctx.services, course);
      if (!can(ctx.subject, "enrollment.create", facts)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      }
      if (course.pricePaise !== 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This course requires payment",
        });
      }
      const outcome = await ctx.services.enrollments.enrol({
        userId: ctx.subject.userId,
        courseId: course.id,
        source: "free",
      });
      if (outcome === "revoked") {
        // Revocations (refunds, abuse) are decided by staff; free re-enrolment must not undo them.
        throw new TRPCError({ code: "FORBIDDEN", message: "ENROLMENT_REVOKED" });
      }
      return { enrolled: true };
    }),
});
