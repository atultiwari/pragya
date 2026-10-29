import { describe, expect, it } from "vitest";
import { parseGrantRoleArgs } from "./args.js";

describe("parseGrantRoleArgs", () => {
  it("parses a platform grant", () => {
    expect(parseGrantRoleArgs(["--email", "Admin@Example.test", "--role", "superadmin"])).toEqual({
      email: "admin@example.test",
      assignment: { role: "superadmin", scope: { type: "platform" } },
      allowUnverified: false,
    });
  });

  it("parses a scoped grant with --scope type:id", () => {
    expect(
      parseGrantRoleArgs([
        "--email",
        "n@example.test",
        "--role",
        "nodal_officer",
        "--scope",
        "institute:01HZY0000000000000000000AA",
      ]),
    ).toEqual({
      email: "n@example.test",
      assignment: {
        role: "nodal_officer",
        scope: { type: "institute", id: "01HZY0000000000000000000AA" },
      },
      allowUnverified: false,
    });
  });

  it.each([
    [[], /--email/],
    [["--email", "x@example.test"], /--role/],
    [["--email", "nope", "--role", "superadmin"], /email/],
    [["--email", "x@example.test", "--role", "wizard"], /role/],
    [["--email", "x@example.test", "--role", "nodal_officer"], /cannot be granted at "platform"/],
    [
      ["--email", "x@example.test", "--role", "superadmin", "--scope", "institute:abc"],
      /cannot be granted at "institute"/,
    ],
    [["--email", "x@example.test", "--role", "teacher", "--scope", "course"], /type:id/],
    [["--email", "x@example.test", "--role", "teacher", "--scope", "galaxy:1"], /scope type/],
  ] as const)("rejects %j", (argv, message) => {
    expect(() => parseGrantRoleArgs([...argv])).toThrow(message);
  });
});
