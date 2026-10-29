import { ACTIONS, type Action } from "./actions.js";
import { isValidAssignment, type Role, type RoleAssignment, type Scope } from "./roles.js";

export type Subject =
  | { readonly kind: "guest" }
  | {
      readonly kind: "user";
      readonly userId: string;
      readonly assignments: readonly RoleAssignment[];
    };

/**
 * Facts about the resource being acted on, resolved by the caller from trusted data
 * (the database and the session), never from the request body.
 */
export interface ResourceContext {
  readonly instituteId?: string;
  readonly batchId?: string;
  readonly courseId?: string;
  /** User who owns the record, e.g. the payee of a payout. */
  readonly ownerUserId?: string;
  readonly isPublished?: boolean;
  readonly isPreview?: boolean;
  /** Whether the subject holds an active enrolment in the course. */
  readonly isEnrolled?: boolean;
  /** Course visibility. When unknown, the course is treated as institute-only. */
  readonly visibility?: CourseVisibility;
  /** Whether the subject belongs to the course's institute. */
  readonly isInstituteMember?: boolean;
}

export type CourseVisibility = "public" | "institute" | "public_and_institute";

const PUBLIC_VISIBILITIES: readonly CourseVisibility[] = ["public", "public_and_institute"];

/** Published, and either listed publicly or the subject belongs to the owning institute. */
function isAvailable(ctx: ResourceContext, allowInstituteMembers: boolean): boolean {
  if (ctx.isPublished !== true) return false;
  if (ctx.visibility !== undefined && PUBLIC_VISIBILITIES.includes(ctx.visibility)) return true;
  return allowInstituteMembers && ctx.isInstituteMember === true;
}

export class ForbiddenError extends Error {
  constructor(readonly action: Action) {
    super(`Forbidden: not allowed to perform "${action}"`);
    this.name = "ForbiddenError";
  }
}

export const guest = (): Subject => ({ kind: "guest" });

export const user = (userId: string, assignments: readonly RoleAssignment[] = []): Subject => ({
  kind: "user",
  userId,
  assignments,
});

/** Actions each role grants, but only where its scope matches the resource. */
const ROLE_GRANTS: Readonly<Record<Role, readonly Action[]>> = {
  superadmin: ACTIONS,
  content_reviewer: [
    "course.read",
    "course.review",
    "course.publish",
    "lesson.read",
    "review.moderate",
  ],
  finance: ["institute.read", "payout.view", "payout.manage", "refund.issue", "audit.read"],
  support: ["institute.read", "course.read", "user.support"],
  tutor: ["course.create", "ai.authoring.use"],
  nodal_officer: [
    "institute.read",
    "institute.update",
    "institute.manage_members",
    "institute.view_analytics",
    "licence.allocate",
    "batch.manage",
    "course.read",
    "course.view_analytics",
  ],
  teacher: [
    "course.read",
    "course.update",
    "course.submit_for_review",
    "course.view_analytics",
    "lesson.read",
    "ai.authoring.use",
  ],
  student: ["institute.read"],
};

/** A teacher scoped to a whole institute may start courses there, but edits need a course scope. */
const INSTITUTE_TEACHER_GRANTS: readonly Action[] = [
  "institute.read",
  "course.create",
  "ai.authoring.use",
];

/** Roles allowed to see another user's payouts. */
const PAYOUT_OVERSIGHT_ROLES: readonly Role[] = ["superadmin", "finance"];

function scopeMatches(scope: Scope, ctx: ResourceContext): boolean {
  switch (scope.type) {
    case "platform":
      return true;
    case "institute":
      return ctx.instituteId === scope.id;
    case "batch":
      return ctx.batchId === scope.id;
    case "course":
      return ctx.courseId === scope.id;
  }
}

function grantsOf(assignment: RoleAssignment): readonly Action[] {
  if (assignment.role === "teacher" && assignment.scope.type === "institute") {
    return INSTITUTE_TEACHER_GRANTS;
  }
  return ROLE_GRANTS[assignment.role];
}

function grantedByAssignment(
  assignment: RoleAssignment,
  action: Action,
  ctx: ResourceContext,
): boolean {
  return (
    isValidAssignment(assignment) &&
    scopeMatches(assignment.scope, ctx) &&
    grantsOf(assignment).includes(action)
  );
}

/** What anyone, signed in or not, may do with published content. */
function grantedToGuest(action: Action, ctx: ResourceContext): boolean {
  switch (action) {
    case "course.read":
      return isAvailable(ctx, false);
    case "lesson.read":
    case "ai.tutor.use":
      return isAvailable(ctx, false) && ctx.isPreview === true;
    default:
      return false;
  }
}

/** What every signed-in user may do, regardless of role. */
function grantedToMember(userId: string, action: Action, ctx: ResourceContext): boolean {
  switch (action) {
    case "course.read":
    case "enrollment.create":
      return isAvailable(ctx, true);
    case "lesson.read":
    case "ai.tutor.use":
      return isAvailable(ctx, true) && (ctx.isPreview === true || ctx.isEnrolled === true);
    case "review.create":
      return isAvailable(ctx, true) && ctx.isEnrolled === true;
    case "payout.view":
      return ctx.ownerUserId === userId;
    default:
      return false;
  }
}

function isSomeoneElsesPayout(userId: string, action: Action, ctx: ResourceContext): boolean {
  return action === "payout.view" && ctx.ownerUserId !== undefined && ctx.ownerUserId !== userId;
}

export function can(subject: Subject, action: Action, ctx: ResourceContext): boolean {
  if (subject.kind === "guest") return grantedToGuest(action, ctx);

  const validAssignments = subject.assignments.filter(isValidAssignment);
  if (isSomeoneElsesPayout(subject.userId, action, ctx)) {
    return validAssignments.some((a) => PAYOUT_OVERSIGHT_ROLES.includes(a.role));
  }
  return (
    grantedToMember(subject.userId, action, ctx) ||
    validAssignments.some((assignment) => grantedByAssignment(assignment, action, ctx))
  );
}

export function assertCan(subject: Subject, action: Action, ctx: ResourceContext): void {
  if (!can(subject, action, ctx)) throw new ForbiddenError(action);
}

export function permittedActions(subject: Subject, ctx: ResourceContext): readonly Action[] {
  return ACTIONS.filter((action) => can(subject, action, ctx));
}
