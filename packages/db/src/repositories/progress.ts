import { and, asc, count, eq, gt, inArray, isNull, max, or, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "../client.js";
import {
  batchMembers,
  courses,
  enrollments,
  lessonProgress,
  lessons,
  modules,
  questionAttempts,
  questions,
} from "../schema/index.js";

type Course = typeof courses.$inferSelect;

export interface LessonRef {
  readonly id: string;
  readonly courseId: string;
}

/** An active enrolment with progress; callers still check course visibility with @pragya/authz. */
export interface EnrolledCourseProgress {
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly status: Course["status"];
    readonly visibility: Course["visibility"];
    readonly instituteId: string | null;
  };
  readonly enrolledAt: Date;
  /** For institute courses: whether the user is in one of the institute's batches. */
  readonly isInstituteMember: boolean;
  readonly lessonsTotal: number;
  readonly lessonsCompleted: number;
  /** The first lesson in outline order not yet completed; null once all are done. */
  readonly nextLesson: {
    readonly slug: string;
    readonly title: string;
    readonly isPreview: boolean;
  } | null;
  /** Latest of enrolment, lesson completion and practice attempt. */
  readonly lastActivityAt: Date;
}

export interface PracticeTally {
  readonly attempted: number;
  /** Attempts with a right/wrong outcome; descriptive answers are not graded yet. */
  readonly graded: number;
  readonly correct: number;
}

export interface LessonAccuracy extends PracticeTally {
  readonly lessonId: string;
  readonly slug: string;
  readonly title: string;
}

export interface CourseAccuracy extends PracticeTally {
  readonly courseId: string;
  readonly lessons: readonly LessonAccuracy[];
}

export interface ProgressRepository {
  /** Idempotent: marking again keeps the first completion time; un-marking removes it. */
  setComplete(userId: string, lesson: LessonRef, completed: boolean): Promise<void>;
  isComplete(userId: string, lessonId: string): Promise<boolean>;
  /** Active, unexpired enrolments in published courses, most recently active first. */
  listEnrolledCourses(userId: string): Promise<readonly EnrolledCourseProgress[]>;
  /** Courses (in the given order) and lessons (in outline order) the user has practised. */
  practiceAccuracy(
    userId: string,
    courseIds: readonly string[],
  ): Promise<readonly CourseAccuracy[]>;
}

/** Bounds the dashboard; a learner with more enrolments sees the most recent ones. */
export const MAX_DASHBOARD_COURSES = 50;

const latest = (...dates: (Date | null | undefined)[]): Date =>
  new Date(Math.max(...dates.map((d) => d?.getTime() ?? 0)));

/** MAX() over a timestamp comes back from mysql2 as a string, not a Date. */
const toDate = (value: unknown): Date | null =>
  value === null || value === undefined ? null : new Date(value as string | Date);

const byCourse = <T extends { courseId: string }>(rows: readonly T[]): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.courseId, [...(groups.get(row.courseId) ?? []), row]);
  return groups;
};

const tally = (rows: readonly PracticeTally[]): PracticeTally => ({
  attempted: rows.reduce((sum, r) => sum + r.attempted, 0),
  graded: rows.reduce((sum, r) => sum + r.graded, 0),
  correct: rows.reduce((sum, r) => sum + r.correct, 0),
});

export function createProgressRepository(db: Database): ProgressRepository {
  const outline = (courseIds: readonly string[]) =>
    db
      .select({
        id: lessons.id,
        courseId: lessons.courseId,
        slug: lessons.slug,
        title: lessons.title,
        isPreview: lessons.isPreview,
      })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .where(inArray(lessons.courseId, [...courseIds]))
      .orderBy(asc(modules.position), asc(lessons.position));

  return {
    async setComplete(userId, lesson, completed) {
      if (!completed) {
        await db
          .delete(lessonProgress)
          .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lesson.id)));
        return;
      }
      await db
        .insert(lessonProgress)
        .values({
          id: ulid(),
          userId,
          lessonId: lesson.id,
          courseId: lesson.courseId,
          completedAt: new Date(),
        })
        .onDuplicateKeyUpdate({ set: { id: sql`${lessonProgress.id}` } });
    },

    async isComplete(userId, lessonId) {
      const [row] = await db
        .select({ id: lessonProgress.id })
        .from(lessonProgress)
        .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
        .limit(1);
      return row !== undefined;
    },

    async listEnrolledCourses(userId) {
      const enrolled = await db
        .select({
          id: courses.id,
          slug: courses.slug,
          title: courses.title,
          status: courses.status,
          visibility: courses.visibility,
          instituteId: courses.instituteId,
          enrolledAt: enrollments.createdAt,
          // One query for every course's institute fact, instead of a lookup per course.
          isInstituteMember: sql<number>`EXISTS (SELECT 1 FROM ${batchMembers} WHERE ${batchMembers.userId} = ${userId} AND ${batchMembers.instituteId} = ${courses.instituteId})`,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(
          and(
            eq(enrollments.userId, userId),
            eq(enrollments.status, "active"),
            // Unpublished courses can't be read by learners; leave them out before the cap applies.
            eq(courses.status, "published"),
            or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, new Date())),
          ),
        )
        .orderBy(sql`${enrollments.createdAt} DESC`)
        .limit(MAX_DASHBOARD_COURSES);
      if (enrolled.length === 0) return [];
      const courseIds = enrolled.map((c) => c.id);

      const [lessonRows, done, attempts] = await Promise.all([
        outline(courseIds),
        db
          .select({ lessonId: lessonProgress.lessonId, completedAt: lessonProgress.completedAt })
          .from(lessonProgress)
          .where(
            and(eq(lessonProgress.userId, userId), inArray(lessonProgress.courseId, courseIds)),
          ),
        db
          .select({ courseId: questionAttempts.courseId, lastAt: max(questionAttempts.createdAt) })
          .from(questionAttempts)
          .where(
            and(eq(questionAttempts.userId, userId), inArray(questionAttempts.courseId, courseIds)),
          )
          .groupBy(questionAttempts.courseId),
      ]);

      const completedAt = new Map(done.map((d) => [d.lessonId, d.completedAt]));
      const lastAttempt = new Map(attempts.map((a) => [a.courseId, toDate(a.lastAt)]));
      const lessonsOf = byCourse(lessonRows);

      const result = enrolled.map(
        ({ enrolledAt, isInstituteMember, ...course }): EnrolledCourseProgress => {
          const own = lessonsOf.get(course.id) ?? [];
          const completed = own.filter((l) => completedAt.has(l.id));
          const next = own.find((l) => !completedAt.has(l.id));
          return {
            course,
            enrolledAt,
            isInstituteMember: Boolean(Number(isInstituteMember)),
            lessonsTotal: own.length,
            lessonsCompleted: completed.length,
            nextLesson: next
              ? { slug: next.slug, title: next.title, isPreview: next.isPreview }
              : null,
            lastActivityAt: latest(
              enrolledAt,
              lastAttempt.get(course.id),
              ...completed.map((l) => completedAt.get(l.id)),
            ),
          };
        },
      );
      return result.toSorted((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    },

    async practiceAccuracy(userId, courseIds) {
      if (courseIds.length === 0) return [];
      const [rows, lessonRows] = await Promise.all([
        db
          .select({
            courseId: questionAttempts.courseId,
            lessonId: questions.lessonId,
            attempted: count(),
            graded: sql<number>`CAST(SUM(${questionAttempts.isCorrect} IS NOT NULL) AS UNSIGNED)`,
            correct: sql<number>`CAST(COALESCE(SUM(${questionAttempts.isCorrect} = 1), 0) AS UNSIGNED)`,
          })
          .from(questionAttempts)
          .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
          .where(
            and(
              eq(questionAttempts.userId, userId),
              inArray(questionAttempts.courseId, [...courseIds]),
            ),
          )
          .groupBy(questionAttempts.courseId, questions.lessonId),
        outline(courseIds),
      ]);
      const perLesson = new Map(
        rows.map((r) => [
          r.lessonId,
          { attempted: Number(r.attempted), graded: Number(r.graded), correct: Number(r.correct) },
        ]),
      );
      const lessonsOf = byCourse(lessonRows);
      return courseIds.flatMap((courseId): CourseAccuracy[] => {
        const practised = (lessonsOf.get(courseId) ?? []).flatMap((l): LessonAccuracy[] => {
          const counts = perLesson.get(l.id);
          return counts ? [{ lessonId: l.id, slug: l.slug, title: l.title, ...counts }] : [];
        });
        return practised.length > 0 ? [{ courseId, ...tally(practised), lessons: practised }] : [];
      });
    },
  };
}
