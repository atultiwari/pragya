import {
  foreignKey,
  index,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { createdAt, id, primaryId, timestamps } from "./columns.js";
import { courses, lessons } from "./catalogue.js";
import { users } from "./identity.js";
import { institutes } from "./tenancy.js";

export const ENROLLMENT_SOURCES = ["purchase", "institute", "unlock_code", "free"] as const;

export const enrollments = mysqlTable(
  "enrollments",
  {
    id: primaryId(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: id("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    source: mysqlEnum("source", ENROLLMENT_SOURCES).notNull(),
    /** Set when the seat comes from an institute licence. */
    instituteId: id("institute_id").references(() => institutes.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["active", "expired", "revoked"]).notNull().default("active"),
    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("enrollments_user_course_uq").on(t.userId, t.courseId),
    index("enrollments_course_idx").on(t.courseId),
    index("enrollments_institute_idx").on(t.instituteId),
  ],
);

/** One row per lesson a learner has marked complete; un-marking deletes the row. */
export const lessonProgress = mysqlTable(
  "lesson_progress",
  {
    id: primaryId(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: id("lesson_id").notNull(),
    /** Denormalised for per-course counts; the composite FK keeps it equal to the lesson's. */
    courseId: id("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("lesson_progress_user_lesson_uq").on(t.userId, t.lessonId),
    index("lesson_progress_user_course_idx").on(t.userId, t.courseId, t.completedAt),
    index("lesson_progress_lesson_course_idx").on(t.lessonId, t.courseId),
    index("lesson_progress_course_idx").on(t.courseId),
    foreignKey({
      name: "lesson_progress_lesson_fk",
      columns: [t.lessonId, t.courseId],
      foreignColumns: [lessons.id, lessons.courseId],
    }).onDelete("cascade"),
  ],
);
