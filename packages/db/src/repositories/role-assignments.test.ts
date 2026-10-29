import { describe, expect, it } from "vitest";
import { fromRoleAssignmentRow, toRoleAssignmentValues } from "./role-assignments.js";

describe("fromRoleAssignmentRow", () => {
  it("maps a platform grant with an empty scope id", () => {
    expect(
      fromRoleAssignmentRow({ role: "superadmin", scopeType: "platform", scopeId: "" }),
    ).toEqual({
      role: "superadmin",
      scope: { type: "platform" },
    });
  });

  it("maps a scoped grant", () => {
    expect(
      fromRoleAssignmentRow({ role: "nodal_officer", scopeType: "institute", scopeId: "inst_1" }),
    ).toEqual({
      role: "nodal_officer",
      scope: { type: "institute", id: "inst_1" },
    });
  });

  it("drops a scoped row with no scope id", () => {
    expect(fromRoleAssignmentRow({ role: "teacher", scopeType: "course", scopeId: "" })).toBeNull();
  });

  it("drops a role held at a scope it is not allowed", () => {
    expect(
      fromRoleAssignmentRow({ role: "superadmin", scopeType: "institute", scopeId: "inst_1" }),
    ).toBeNull();
  });
});

describe("toRoleAssignmentValues", () => {
  it("stores platform scope as an empty scope id", () => {
    expect(
      toRoleAssignmentValues({
        userId: "u_1",
        assignment: { role: "finance", scope: { type: "platform" } },
      }),
    ).toEqual({
      userId: "u_1",
      role: "finance",
      scopeType: "platform",
      scopeId: "",
      grantedBy: null,
    });
  });

  it("keeps the granting user", () => {
    expect(
      toRoleAssignmentValues({
        userId: "u_1",
        grantedBy: "u_admin",
        assignment: { role: "student", scope: { type: "batch", id: "b_1" } },
      }),
    ).toEqual({
      userId: "u_1",
      role: "student",
      scopeType: "batch",
      scopeId: "b_1",
      grantedBy: "u_admin",
    });
  });

  it("rejects an assignment at a disallowed scope", () => {
    expect(() =>
      toRoleAssignmentValues({
        userId: "u_1",
        assignment: { role: "nodal_officer", scope: { type: "platform" } },
      }),
    ).toThrow(/nodal_officer.*platform/);
  });
});
