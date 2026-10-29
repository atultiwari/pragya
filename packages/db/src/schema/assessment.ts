import {
  boolean,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { createdAt, id, primaryId, timestamps } from "./columns.js";
import { courses, lessons } from "./catalogue.js";
import { users } from "./identity.js";

export const QUESTION_FORMATS = [
  "mcq",
  "scenario_mcq",
  "multi_select",
  "true_false",
  "fib",
  "saq",
  "laq",
  "why",
  "case",
] as const;

/**
 * Question bank, imported from content packs. `body` holds the full validated question
 * (options, key, explanation); only @pragya/assessment's learnerView is ever sent before answering.
 */
export const questions = mysqlTable(
  "questions",
  {
    id: primaryId(),
    courseId: id("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lessonId: id("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    /** The pack's question id; re-imports update in place by slug. */
    slug: varchar("slug", { length: 80 }).notNull(),
    format: mysqlEnum("format", QUESTION_FORMATS).notNull(),
    difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]),
    tags: json("tags").$type<readonly string[]>().notNull(),
    body: json("body").$type<Record<string, unknown>>().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("questions_course_slug_uq").on(t.courseId, t.slug),
    index("questions_lesson_idx").on(t.lessonId),
  ],
);

/** One row per answer submitted; feeds mastery, analytics and spaced repetition later. */
export const questionAttempts = mysqlTable(
  "question_attempts",
  {
    id: primaryId(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: id("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    /** Denormalised for per-course progress queries. */
    courseId: id("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** null for descriptive answers until self-assessed. */
    isCorrect: boolean("is_correct"),
    response: json("response").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("question_attempts_user_course_idx").on(t.userId, t.courseId, t.createdAt),
    index("question_attempts_question_idx").on(t.questionId),
  ],
);
