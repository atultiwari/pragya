import { learnerView, parseResponse, score } from "@pragya/assessment";
import { can, type ResourceContext, type Subject } from "@pragya/authz";
import { questionSchema, slugSchema, type Question } from "@pragya/content";
import type { StoredQuestion } from "@pragya/db";
import { TRPCError } from "@trpc/server";
import { z, ZodError } from "zod";
import { publicProcedure, router } from "../trpc.js";
import { loadReadableLesson, quizPools } from "./lesson-access.js";

const where = { courseSlug: slugSchema, lessonSlug: slugSchema };

/** Stored bodies were validated at import; re-check so a bad row is skipped, not served. */
const toQuestion = (stored: StoredQuestion): Question | null => {
  const parsed = questionSchema.safeParse(stored.body);
  return parsed.success ? parsed.data : null;
};

/**
 * A pool may reach questions of other lessons through a tag, so each question is only
 * shown or answered when the caller could read the lesson it belongs to.
 */
const mayUse = (subject: Subject, facts: ResourceContext, question: StoredQuestion): boolean =>
  can(subject, "lesson.read", { ...facts, isPreview: question.lessonIsPreview });

export const practiceRouter = router({
  /** A lesson's embedded quiz, without keys or explanations. */
  quiz: publicProcedure
    .input(z.object({ ...where, poolRef: slugSchema }))
    .query(async ({ ctx, input }) => {
      const { lesson, blocks, facts } = await loadReadableLesson(
        ctx,
        input.courseSlug,
        input.lessonSlug,
      );
      if (!quizPools(blocks).includes(input.poolRef)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found" });
      }
      const stored = await ctx.services.questions.listPools(lesson.course.id, [input.poolRef]);
      const questions = stored
        .filter((q) => mayUse(ctx.subject, facts, q))
        .map(toQuestion)
        .filter((q): q is Question => q !== null);
      return { questions: questions.map(learnerView) };
    }),

  /** Scores on the server (keys never reach the browser first) and records signed-in attempts. */
  answer: publicProcedure
    .input(z.object({ ...where, questionId: slugSchema, response: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      const { lesson, blocks, facts } = await loadReadableLesson(
        ctx,
        input.courseSlug,
        input.lessonSlug,
      );
      const stored = await ctx.services.questions.findInPools(
        lesson.course.id,
        input.questionId,
        quizPools(blocks),
      );
      const question = stored ? toQuestion(stored) : null;
      if (!stored || !question || !mayUse(ctx.subject, facts, stored)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      let response;
      try {
        response = parseResponse(question, input.response);
      } catch (error: unknown) {
        if (error instanceof ZodError)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid answer" });
        throw error;
      }
      const result = score(question, response);
      if (ctx.subject.kind === "user") {
        const recorded = await ctx.services.questions.recordAttempt({
          userId: ctx.subject.userId,
          questionId: stored.id,
          courseId: lesson.course.id,
          isCorrect: result.correct,
          response: { ...response },
        });
        if (!recorded) {
          // Also slows down scripted key harvesting; guests are covered by the global rate limit.
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many answers; take a short break",
          });
        }
      }
      return result;
    }),
});
