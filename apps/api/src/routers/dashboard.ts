import { can, type Subject } from "@pragya/authz";
import type { CourseAccuracy, EnrolledCourseProgress, PracticeTally } from "@pragya/db";
import { router, signedInProcedure } from "../trpc.js";

/** Share of graded answers that were right; null until something has been graded. */
export const accuracyOf = ({ graded, correct }: PracticeTally): number | null =>
  graded === 0 ? null : correct / graded;

const practiceView = (accuracy: CourseAccuracy | undefined) =>
  accuracy
    ? {
        attempted: accuracy.attempted,
        graded: accuracy.graded,
        correct: accuracy.correct,
        accuracy: accuracyOf(accuracy),
        lessons: accuracy.lessons.map(({ slug, title, attempted, graded, correct }) => ({
          slug,
          title,
          attempted,
          graded,
          correct,
          accuracy: accuracyOf({ attempted, graded, correct }),
        })),
      }
    : null;

/**
 * Enrolments stay on record when a course is archived or access changes, so each one is
 * re-checked. The facts come from the same query that proved the enrolment active, so this
 * needs no per-course lookups.
 */
const visibleCourses = (
  subject: Subject,
  enrolled: readonly EnrolledCourseProgress[],
): EnrolledCourseProgress[] =>
  enrolled.filter(({ course, isInstituteMember }) =>
    can(subject, "course.read", {
      courseId: course.id,
      ...(course.instituteId ? { instituteId: course.instituteId } : {}),
      isPublished: course.status === "published",
      visibility: course.visibility,
      isEnrolled: true,
      isInstituteMember,
    }),
  );

export const dashboardRouter = router({
  /** The signed-in learner's courses, progress, practice accuracy and where to pick up. */
  overview: signedInProcedure.query(async ({ ctx }) => {
    const courses = visibleCourses(
      ctx.subject,
      await ctx.services.progress.listEnrolledCourses(ctx.userId),
    );
    const accuracy =
      courses.length === 0
        ? []
        : await ctx.services.progress.practiceAccuracy(
            ctx.userId,
            courses.map((c) => c.course.id),
          );
    const accuracyOfCourse = new Map(accuracy.map((a) => [a.courseId, a]));
    // listEnrolledCourses returns the most recently active first.
    const resumeFrom = courses.find((c) => c.nextLesson !== null);

    return {
      courses: courses.map((c) => ({
        slug: c.course.slug,
        title: c.course.title,
        lessonsTotal: c.lessonsTotal,
        lessonsCompleted: c.lessonsCompleted,
        nextLesson: c.nextLesson ? { slug: c.nextLesson.slug, title: c.nextLesson.title } : null,
        lastActivityAt: c.lastActivityAt.toISOString(),
        practice: practiceView(accuracyOfCourse.get(c.course.id)),
      })),
      resume: resumeFrom?.nextLesson
        ? {
            courseSlug: resumeFrom.course.slug,
            courseTitle: resumeFrom.course.title,
            lessonSlug: resumeFrom.nextLesson.slug,
            lessonTitle: resumeFrom.nextLesson.title,
          }
        : null,
    };
  }),
});
