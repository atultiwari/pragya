import { slugSchema } from "@pragya/content";
import { z } from "zod";
import { router, signedInProcedure } from "../trpc.js";
import { loadReadableLesson } from "./lesson-access.js";

const where = { courseSlug: slugSchema, lessonSlug: slugSchema };

export const progressRouter = router({
  /** Whether the caller has completed a lesson they can read. */
  lesson: signedInProcedure.input(z.object(where)).query(async ({ ctx, input }) => {
    const { lesson } = await loadReadableLesson(ctx, input.courseSlug, input.lessonSlug);
    return { completed: await ctx.services.progress.isComplete(ctx.userId, lesson.id) };
  }),

  /**
   * Marks (or with `completed: false`, un-marks) a lesson complete. Goes through the same access
   * path as the lesson body, and the course is taken from the lesson row, never from input.
   */
  markComplete: signedInProcedure
    .input(z.object({ ...where, completed: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const { lesson } = await loadReadableLesson(ctx, input.courseSlug, input.lessonSlug);
      await ctx.services.progress.setComplete(
        ctx.userId,
        { id: lesson.id, courseId: lesson.course.id },
        input.completed,
      );
      return { completed: input.completed };
    }),
});
