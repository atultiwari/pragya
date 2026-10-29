import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  boolean,
} from "drizzle-orm/mysql-core";
import { id, primaryId, timestamps } from "./columns.js";
import { users } from "./identity.js";
import { institutes } from "./tenancy.js";

export const streams = mysqlTable(
  "streams",
  {
    id: primaryId(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("streams_slug_uq").on(t.slug)],
);

export const COURSE_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export const COURSE_VISIBILITIES = ["public", "institute", "public_and_institute"] as const;

export const courses = mysqlTable(
  "courses",
  {
    id: primaryId(),
    streamId: id("stream_id")
      .notNull()
      .references(() => streams.id),
    /** Set for institute-owned courses; null for marketplace courses. */
    instituteId: id("institute_id").references(() => institutes.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    summary: text("summary"),
    status: mysqlEnum("status", COURSE_STATUSES).notNull().default("draft"),
    visibility: mysqlEnum("visibility", COURSE_VISIBILITIES).notNull().default("public"),
    /** Money is always integer paise. */
    pricePaise: int("price_paise", { unsigned: true }).notNull().default(0),
    language: varchar("language", { length: 10 }).notNull().default("en"),
    publishedAt: timestamp("published_at", { mode: "date", fsp: 3 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("courses_slug_uq").on(t.slug),
    index("courses_stream_status_idx").on(t.streamId, t.status),
    index("courses_institute_idx").on(t.instituteId),
    // An institute-only course must belong to an institute.
    check(
      "courses_visibility_institute_ck",
      sql`${t.visibility} = 'public' OR ${t.instituteId} IS NOT NULL`,
    ),
  ],
);

export const courseTutors = mysqlTable(
  "course_tutors",
  {
    courseId: id("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Share of the tutor pool for this course, 0–100. */
    revenueSharePct: decimal("revenue_share_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("100.00"),
    isLead: boolean("is_lead").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.userId] }),
    index("course_tutors_user_idx").on(t.userId),
  ],
);

export const modules = mysqlTable(
  "modules",
  {
    id: primaryId(),
    courseId: id("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    position: smallint("position").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("modules_course_position_uq").on(t.courseId, t.position),
    // Target of lessons' composite FK, which pins a lesson's course to its module's course.
    uniqueIndex("modules_id_course_uq").on(t.id, t.courseId),
  ],
);

export const lessons = mysqlTable(
  "lessons",
  {
    id: primaryId(),
    moduleId: id("module_id").notNull(),
    /** Denormalised so access checks need no join; the composite FK keeps it equal to the module's. */
    courseId: id("course_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    position: smallint("position").notNull(),
    isPreview: boolean("is_preview").notNull().default(false),
    /** Ordered content-pack blocks (paragraph, table, figure, video ref, sim ref, quiz-pool ref…). */
    blocks: json("blocks").$type<readonly unknown[]>().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("lessons_module_position_uq").on(t.moduleId, t.position),
    index("lessons_course_idx").on(t.courseId),
    foreignKey({
      name: "lessons_module_fk",
      columns: [t.moduleId, t.courseId],
      foreignColumns: [modules.id, modules.courseId],
    }).onDelete("cascade"),
  ],
);
