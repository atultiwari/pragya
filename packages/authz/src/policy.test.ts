import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  ForbiddenError,
  assertCan,
  can,
  guest,
  isValidAssignment,
  permittedActions,
  user,
  type Action,
  type ResourceContext,
  type RoleAssignment,
  type Subject,
} from "./index.js";

const INSTITUTE_A = "inst_a";
const INSTITUTE_B = "inst_b";
const COURSE_A = "course_a";
const COURSE_B = "course_b";
const BATCH_A = "batch_a";

const as = (...assignments: RoleAssignment[]): Subject => user("u_1", assignments);

const superadmin = as({ role: "superadmin", scope: { type: "platform" } });
const reviewer = as({ role: "content_reviewer", scope: { type: "platform" } });
const finance = as({ role: "finance", scope: { type: "platform" } });
const support = as({ role: "support", scope: { type: "platform" } });
const tutor = as({ role: "tutor", scope: { type: "platform" } });
const nodalA = as({ role: "nodal_officer", scope: { type: "institute", id: INSTITUTE_A } });
const courseTeacherA = as({ role: "teacher", scope: { type: "course", id: COURSE_A } });
const instituteTeacherA = as({ role: "teacher", scope: { type: "institute", id: INSTITUTE_A } });
const studentBatchA = as({ role: "student", scope: { type: "batch", id: BATCH_A } });
const member = as();
const visitor = guest();

const instituteA: ResourceContext = { instituteId: INSTITUTE_A };
const instituteB: ResourceContext = { instituteId: INSTITUTE_B };
const courseA: ResourceContext = { courseId: COURSE_A, instituteId: INSTITUTE_A };
const courseB: ResourceContext = { courseId: COURSE_B, instituteId: INSTITUTE_B };
const publishedCourse: ResourceContext = {
  courseId: COURSE_B,
  isPublished: true,
  visibility: "public",
};
const instituteOnlyCourse: ResourceContext = {
  courseId: COURSE_A,
  instituteId: INSTITUTE_A,
  isPublished: true,
  visibility: "institute",
};
const previewLesson: ResourceContext = { ...publishedCourse, isPreview: true };
const paidLesson: ResourceContext = { ...publishedCourse, isPreview: false };
const enrolledLesson: ResourceContext = { ...paidLesson, isEnrolled: true };

type Case = readonly [
  label: string,
  subject: Subject,
  action: Action,
  ctx: ResourceContext,
  expected: boolean,
];

const MATRIX: readonly Case[] = [
  // platform administration
  ["superadmin manages platform", superadmin, "platform.manage", {}, true],
  ["superadmin creates institute", superadmin, "institute.create", {}, true],
  ["nodal officer cannot create institute", nodalA, "institute.create", {}, false],
  ["tutor cannot manage platform", tutor, "platform.manage", {}, false],

  // institute tenancy: own vs foreign
  [
    "nodal officer manages own institute members",
    nodalA,
    "institute.manage_members",
    instituteA,
    true,
  ],
  [
    "nodal officer cannot manage foreign institute",
    nodalA,
    "institute.manage_members",
    instituteB,
    false,
  ],
  ["nodal officer allocates own licences", nodalA, "licence.allocate", instituteA, true],
  ["nodal officer cannot allocate foreign licences", nodalA, "licence.allocate", instituteB, false],
  ["nodal officer sees own analytics", nodalA, "institute.view_analytics", instituteA, true],
  [
    "nodal officer cannot see foreign analytics",
    nodalA,
    "institute.view_analytics",
    instituteB,
    false,
  ],
  ["nodal officer manages own batches", nodalA, "batch.manage", instituteA, true],
  ["nodal officer cannot publish courses", nodalA, "course.publish", courseA, false],
  [
    "batch student reads own institute",
    studentBatchA,
    "institute.read",
    { ...instituteA, batchId: BATCH_A },
    true,
  ],
  [
    "batch student cannot manage members",
    studentBatchA,
    "institute.manage_members",
    { ...instituteA, batchId: BATCH_A },
    false,
  ],

  // course authoring
  ["course teacher updates own course", courseTeacherA, "course.update", courseA, true],
  ["course teacher cannot update other course", courseTeacherA, "course.update", courseB, false],
  [
    "course teacher submits own course for review",
    courseTeacherA,
    "course.submit_for_review",
    courseA,
    true,
  ],
  ["course teacher cannot publish own course", courseTeacherA, "course.publish", courseA, false],
  [
    "course teacher uses authoring AI on own course",
    courseTeacherA,
    "ai.authoring.use",
    courseA,
    true,
  ],
  [
    "institute teacher creates institute course",
    instituteTeacherA,
    "course.create",
    instituteA,
    true,
  ],
  [
    "institute teacher cannot create in foreign institute",
    instituteTeacherA,
    "course.create",
    instituteB,
    false,
  ],
  [
    "institute teacher cannot update a course without course scope",
    instituteTeacherA,
    "course.update",
    courseA,
    false,
  ],
  ["marketplace tutor creates a course", tutor, "course.create", {}, true],
  ["plain member cannot create a course", member, "course.create", {}, false],

  // review and publishing
  ["content reviewer reviews any course", reviewer, "course.review", courseB, true],
  ["content reviewer publishes any course", reviewer, "course.publish", courseB, true],
  ["content reviewer moderates reviews", reviewer, "review.moderate", courseB, true],
  ["content reviewer cannot issue refunds", reviewer, "refund.issue", {}, false],

  // money
  ["finance issues refunds", finance, "refund.issue", {}, true],
  ["finance manages payouts", finance, "payout.manage", {}, true],
  ["tutor views own payouts", tutor, "payout.view", { ownerUserId: "u_1" }, true],
  ["tutor cannot view someone else's payouts", tutor, "payout.view", { ownerUserId: "u_2" }, false],
  ["tutor cannot manage payouts", tutor, "payout.manage", { ownerUserId: "u_1" }, false],
  ["support cannot issue refunds", support, "refund.issue", {}, false],
  ["support helps users", support, "user.support", {}, true],

  // learning access
  ["guest reads published course page", visitor, "course.read", publishedCourse, true],
  ["guest cannot read unpublished course", visitor, "course.read", courseB, false],
  ["guest reads preview lesson", visitor, "lesson.read", previewLesson, true],
  ["guest cannot read paid lesson", visitor, "lesson.read", paidLesson, false],
  ["guest uses AI tutor on preview lesson", visitor, "ai.tutor.use", previewLesson, true],
  ["guest cannot enrol", visitor, "enrollment.create", publishedCourse, false],
  ["member enrols in published course", member, "enrollment.create", publishedCourse, true],
  ["member cannot read paid lesson unenrolled", member, "lesson.read", paidLesson, false],
  ["enrolled member reads paid lesson", member, "lesson.read", enrolledLesson, true],
  ["enrolled member uses AI tutor", member, "ai.tutor.use", enrolledLesson, true],
  ["enrolled member writes a review", member, "review.create", enrolledLesson, true],
  ["unenrolled member cannot review", member, "review.create", paidLesson, false],
  ["member cannot read audit log", member, "audit.read", {}, false],

  // institute-only courses stay inside the institute
  ["guest cannot see an institute-only course", visitor, "course.read", instituteOnlyCourse, false],
  [
    "guest cannot preview an institute-only lesson",
    visitor,
    "lesson.read",
    { ...instituteOnlyCourse, isPreview: true },
    false,
  ],
  [
    "outsider cannot see an institute-only course",
    member,
    "course.read",
    instituteOnlyCourse,
    false,
  ],
  [
    "outsider cannot enrol in an institute-only course",
    member,
    "enrollment.create",
    instituteOnlyCourse,
    false,
  ],
  [
    "institute member sees an institute-only course",
    member,
    "course.read",
    { ...instituteOnlyCourse, isInstituteMember: true },
    true,
  ],
  [
    "institute member reads an enrolled institute lesson",
    member,
    "lesson.read",
    { ...instituteOnlyCourse, isInstituteMember: true, isEnrolled: true },
    true,
  ],
  [
    "dual-listed course is public",
    visitor,
    "course.read",
    { ...instituteOnlyCourse, visibility: "public_and_institute" },
    true,
  ],
  [
    "published course with unknown visibility is hidden",
    visitor,
    "course.read",
    { courseId: COURSE_B, isPublished: true },
    false,
  ],
];

describe("can — role × action × tenant matrix", () => {
  it.each(MATRIX)("%s", (_label, subject, action, ctx, expected) => {
    expect(can(subject, action, ctx)).toBe(expected);
  });

  it("grants superadmin every action", () => {
    for (const action of ACTIONS) {
      expect(can(superadmin, action, {}), action).toBe(true);
    }
  });

  it("grants a nodal officer nothing in a foreign institute", () => {
    for (const action of ACTIONS) {
      expect(can(nodalA, action, instituteB), action).toBe(false);
    }
  });

  it("grants a guest nothing on unpublished content", () => {
    for (const action of ACTIONS) {
      expect(can(visitor, action, { courseId: COURSE_A, isPreview: true }), action).toBe(false);
    }
  });

  it("combines several assignments held by one user", () => {
    const teacherAndStudent = as(
      { role: "teacher", scope: { type: "course", id: COURSE_A } },
      { role: "student", scope: { type: "institute", id: INSTITUTE_B } },
    );
    expect(can(teacherAndStudent, "course.update", courseA)).toBe(true);
    expect(can(teacherAndStudent, "institute.read", instituteB)).toBe(true);
    expect(can(teacherAndStudent, "institute.read", instituteA)).toBe(false);
  });
});

describe("isValidAssignment", () => {
  it.each([
    [{ role: "superadmin", scope: { type: "platform" } }, true],
    [{ role: "superadmin", scope: { type: "institute", id: INSTITUTE_A } }, false],
    [{ role: "nodal_officer", scope: { type: "institute", id: INSTITUTE_A } }, true],
    [{ role: "nodal_officer", scope: { type: "platform" } }, false],
    [{ role: "teacher", scope: { type: "course", id: COURSE_A } }, true],
    [{ role: "teacher", scope: { type: "batch", id: BATCH_A } }, false],
    [{ role: "student", scope: { type: "batch", id: BATCH_A } }, true],
    [{ role: "tutor", scope: { type: "course", id: COURSE_A } }, false],
    [{ role: "nodal_officer", scope: { type: "institute", id: "" } }, false],
    [{ role: "teacher", scope: { type: "course", id: "   " } }, false],
  ] as const)("%j → %s", (assignment, expected) => {
    expect(isValidAssignment(assignment)).toBe(expected);
  });

  it("never matches an empty scope id against a context without that id", () => {
    const blank = as({ role: "nodal_officer", scope: { type: "institute", id: "" } });
    expect(can(blank, "institute.manage_members", { instituteId: "" })).toBe(false);
  });

  it("ignores an invalid assignment when deciding access", () => {
    const misassigned = as({ role: "superadmin", scope: { type: "institute", id: INSTITUTE_A } });
    expect(can(misassigned, "platform.manage", {})).toBe(false);
  });
});

describe("assertCan", () => {
  it("returns silently when allowed", () => {
    expect(() => assertCan(superadmin, "audit.read", {})).not.toThrow();
  });

  it("throws ForbiddenError naming the action when denied", () => {
    expect(() => assertCan(member, "audit.read", {})).toThrow(ForbiddenError);
    expect(() => assertCan(member, "audit.read", {})).toThrow(/audit\.read/);
  });
});

describe("permittedActions", () => {
  it("lists what a guest may do on a preview lesson", () => {
    expect(permittedActions(visitor, previewLesson)).toEqual([
      "course.read",
      "lesson.read",
      "ai.tutor.use",
    ]);
  });
});
