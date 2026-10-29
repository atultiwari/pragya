import type { RoleAssignment } from "@pragya/authz";
import { describe, expect, it, vi } from "vitest";
import { createSubjectResolver, toWebHeaders } from "./context.js";

const nodal: RoleAssignment = { role: "nodal_officer", scope: { type: "institute", id: "inst_a" } };

describe("createSubjectResolver", () => {
  it("returns a guest when there is no session", async () => {
    const listAssignments = vi.fn();
    const resolve = createSubjectResolver({ getUserId: async () => null, listAssignments });
    expect(await resolve(new Headers())).toEqual({ kind: "guest" });
    expect(listAssignments).not.toHaveBeenCalled();
  });

  it("returns the signed-in user with their role assignments", async () => {
    const listAssignments = vi.fn(async () => [nodal]);
    const resolve = createSubjectResolver({ getUserId: async () => "u_1", listAssignments });
    expect(await resolve(new Headers({ cookie: "s=1" }))).toEqual({
      kind: "user",
      userId: "u_1",
      assignments: [nodal],
    });
    expect(listAssignments).toHaveBeenCalledWith("u_1");
  });

  it("propagates lookup failures instead of silently downgrading to guest", async () => {
    const resolve = createSubjectResolver({
      getUserId: async () => {
        throw new Error("db down");
      },
      listAssignments: async () => [],
    });
    await expect(resolve(new Headers())).rejects.toThrow("db down");
  });
});

describe("toWebHeaders", () => {
  it("copies single and repeated Node headers", () => {
    const headers = toWebHeaders({ cookie: "a=1", "x-multi": ["1", "2"], skipped: undefined });
    expect(headers.get("cookie")).toBe("a=1");
    expect(headers.get("x-multi")).toBe("1, 2");
    expect(headers.has("skipped")).toBe(false);
  });
});
