import { and, eq, gt, isNull, or } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "../client.js";
import type { ENROLLMENT_SOURCES } from "../schema/index.js";
import { batchMembers, enrollments } from "../schema/index.js";

export interface EnrolInput {
  readonly userId: string;
  readonly courseId: string;
  readonly source: (typeof ENROLLMENT_SOURCES)[number];
  readonly instituteId?: string;
}

/**
 * created: new row · existing: already active · reactivated: an expired or lapsed row was
 * renewed · revoked: an administrator revoked access (e.g. refund), left unchanged.
 */
export type EnrolOutcome = "created" | "existing" | "reactivated" | "revoked";

export interface EnrollmentRepository {
  /** Active and not expired. */
  isEnrolled(userId: string, courseId: string): Promise<boolean>;
  /** Creates or renews the enrolment; never duplicates and never overrides a revocation. */
  enrol(input: EnrolInput): Promise<EnrolOutcome>;
  isInstituteMember(userId: string, instituteId: string): Promise<boolean>;
}

/** Drizzle wraps driver errors; the MySQL code sits on the cause. */
function isDuplicateKey(error: unknown): boolean {
  const code = (e: unknown) => (e && typeof e === "object" && "code" in e ? e.code : undefined);
  return (
    code(error) === "ER_DUP_ENTRY" ||
    code((error as { cause?: unknown } | null)?.cause) === "ER_DUP_ENTRY"
  );
}

export function createEnrollmentRepository(db: Database): EnrollmentRepository {
  return {
    async isEnrolled(userId, courseId) {
      const [row] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.userId, userId),
            eq(enrollments.courseId, courseId),
            eq(enrollments.status, "active"),
            or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, new Date())),
          ),
        )
        .limit(1);
      return row !== undefined;
    },

    async enrol({ userId, courseId, source, instituteId }) {
      try {
        await db.insert(enrollments).values({
          id: ulid(),
          userId,
          courseId,
          source,
          ...(instituteId ? { instituteId } : {}),
        });
        return "created";
      } catch (error: unknown) {
        if (!isDuplicateKey(error)) throw error;
      }
      // One row per (user, course): decide from its state instead of assuming it is usable.
      const match = and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId));
      const [row] = await db
        .select({ status: enrollments.status, expiresAt: enrollments.expiresAt })
        .from(enrollments)
        .where(match)
        .limit(1);
      if (row?.status === "revoked") return "revoked";
      if (row?.status === "active" && (row.expiresAt === null || row.expiresAt > new Date())) {
        return "existing";
      }
      await db.update(enrollments).set({ status: "active", expiresAt: null, source }).where(match);
      return "reactivated";
    },

    async isInstituteMember(userId, instituteId) {
      const [row] = await db
        .select({ userId: batchMembers.userId })
        .from(batchMembers)
        .where(and(eq(batchMembers.userId, userId), eq(batchMembers.instituteId, instituteId)))
        .limit(1);
      return row !== undefined;
    },
  };
}
