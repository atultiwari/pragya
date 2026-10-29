import { describe, expect, it } from "vitest";
import { parseAuthEnv } from "./config.js";

const SECRET = "x".repeat(32);
const base = { BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: "http://localhost:4000" };

describe("parseAuthEnv", () => {
  it("applies defaults and splits trusted origins", () => {
    expect(
      parseAuthEnv({ ...base, WEB_ORIGIN: "http://localhost:3000, https://pragya.ai" }),
    ).toEqual({
      secret: SECRET,
      baseUrl: "http://localhost:4000",
      trustedOrigins: ["http://localhost:3000", "https://pragya.ai"],
      requireEmailVerification: false,
      google: null,
      isProduction: false,
      devSenders: false,
    });
  });

  it("enables Google only when both credentials are present", () => {
    const env = parseAuthEnv({ ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    expect(env.google).toEqual({ clientId: "id", clientSecret: "secret" });
    expect(() => parseAuthEnv({ ...base, GOOGLE_CLIENT_ID: "id" })).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("enables dev senders only on explicit opt-in, never in production", () => {
    expect(parseAuthEnv({ ...base, AUTH_DEV_SENDERS: "true" }).devSenders).toBe(true);
    expect(parseAuthEnv({ ...base, NODE_ENV: "staging" }).devSenders).toBe(false);
    expect(() =>
      parseAuthEnv({ ...base, NODE_ENV: "production", AUTH_DEV_SENDERS: "true" }),
    ).toThrow(/AUTH_DEV_SENDERS/);
  });

  it("treats empty optional values as unset", () => {
    const env = parseAuthEnv({
      ...base,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      AUTH_REQUIRE_EMAIL_VERIFICATION: "",
    });
    expect(env.google).toBeNull();
    expect(env.requireEmailVerification).toBe(false);
  });

  it("parses the email-verification switch strictly", () => {
    expect(
      parseAuthEnv({ ...base, AUTH_REQUIRE_EMAIL_VERIFICATION: "true" }).requireEmailVerification,
    ).toBe(true);
    expect(
      parseAuthEnv({ ...base, AUTH_REQUIRE_EMAIL_VERIFICATION: "false" }).requireEmailVerification,
    ).toBe(false);
    expect(() => parseAuthEnv({ ...base, AUTH_REQUIRE_EMAIL_VERIFICATION: "yes" })).toThrow();
  });

  it("requires email verification in production", () => {
    expect(parseAuthEnv({ ...base, NODE_ENV: "production" })).toMatchObject({
      isProduction: true,
      requireEmailVerification: true,
    });
  });

  it("rejects a short secret or bad URL, naming the variable", () => {
    expect(() => parseAuthEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(() => parseAuthEnv({ ...base, BETTER_AUTH_URL: "nope" })).toThrow(/BETTER_AUTH_URL/);
  });
});
