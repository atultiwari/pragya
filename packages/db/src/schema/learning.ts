import { index, mysqlEnum, mysqlTable, timestamp, uniqueIndex } from "drizzle-orm/mysql-core";
import { id, primaryId, timestamps } from "./columns.js";
import { courses } from "./catalogue.js";
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
