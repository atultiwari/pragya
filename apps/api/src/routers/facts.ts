import type { ResourceContext, Subject } from "@pragya/authz";
import type { Services } from "../services.js";

export interface CourseAccessFacts {
  readonly id: string;
  readonly status: "draft" | "in_review" | "published" | "archived";
  readonly visibility: "public" | "institute" | "public_and_institute";
  readonly instituteId: string | null;
}

/**
 * Resolves authz facts for a course from the database and session — never from input —
 * so `can()` decides on trusted data (see ResourceContext in @pragya/authz).
 */
export async function courseFacts(
  subject: Subject,
  services: Services,
  course: CourseAccessFacts,
): Promise<ResourceContext> {
  const signedIn = subject.kind === "user";
  const [isEnrolled, isInstituteMember] = await Promise.all([
    signedIn ? services.enrollments.isEnrolled(subject.userId, course.id) : false,
    signedIn && course.instituteId
      ? services.enrollments.isInstituteMember(subject.userId, course.instituteId)
      : false,
  ]);
  return {
    courseId: course.id,
    ...(course.instituteId ? { instituteId: course.instituteId } : {}),
    isPublished: course.status === "published",
    visibility: course.visibility,
    isEnrolled,
    isInstituteMember,
  };
}
