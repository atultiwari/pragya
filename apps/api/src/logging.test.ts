import { describe, expect, it } from "vitest";
import { redactUrl } from "./logging.js";

describe("redactUrl", () => {
  it.each([
    [
      "/api/auth/verify-email?token=abc.def&callbackURL=/x",
      "/api/auth/verify-email?token=%5BREDACTED%5D&callbackURL=%2Fx",
    ],
    [
      "/api/auth/reset-password/tok123?callbackURL=/r",
      "/api/auth/reset-password/[REDACTED]?callbackURL=%2Fr",
    ],
    ["/trpc/me.whoami", "/trpc/me.whoami"],
    ["/health?code=123456", "/health?code=%5BREDACTED%5D"],
  ])("%s", (url, expected) => {
    expect(redactUrl(url)).toBe(expected);
  });
});
