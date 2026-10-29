import { can, type ResourceContext } from "@pragya/authz";
import { blockSchema, type Block } from "@pragya/content";
import type { LessonView } from "@pragya/db";
import { TRPCError } from "@trpc/server";
import type { RequestContext } from "../context.js";
import { courseFacts } from "./facts.js";

export interface ReadableLesson {
  readonly lesson: LessonView;
  readonly blocks: readonly unknown[];
  /** Course-level authz facts, for checking other lessons of the same course. */
  readonly facts: ResourceContext;
}

/** Same response whether a course is missing or hidden, so existence isn't leaked. */
export const courseNotFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: "Course not found" });

/**
 * The single access path for anything inside a lesson (body, quizzes, answers): the course
 * must be visible and the lesson readable. The body is read only after both checks pass.
 */
export async function loadReadableLesson(
  ctx: RequestContext,
  courseSlug: string,
  lessonSlug: string,
): Promise<ReadableLesson> {
  const lesson = await ctx.services.catalogue.getLesson(courseSlug, lessonSlug);
  if (!lesson) throw courseNotFound();
  const facts = await courseFacts(ctx.subject, ctx.services, lesson.course);
  if (!can(ctx.subject, "course.read", facts)) throw courseNotFound();
  if (!can(ctx.subject, "lesson.read", { ...facts, isPreview: lesson.isPreview })) {
    // A stable machine-readable message the web app turns into an "Enrol to continue" prompt.
    throw new TRPCError({ code: "FORBIDDEN", message: "ENROLMENT_REQUIRED" });
  }
  return { lesson, facts, blocks: await ctx.services.catalogue.getLessonBlocks(lesson.id) };
}

/** The quiz pools a lesson embeds; only these can be practised from it. */
export function quizPools(blocks: readonly unknown[]): string[] {
  return blocks.flatMap((raw) => {
    const block = blockSchema.safeParse(raw);
    return block.success && block.data.type === "quiz"
      ? [(block.data as Extract<Block, { type: "quiz" }>).poolRef]
      : [];
  });
}
