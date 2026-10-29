import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("applies defaults", () => {
    expect(parseEnv({})).toEqual({
      API_PORT: 4000,
      API_HOST: "0.0.0.0",
      WEB_ORIGIN: "http://localhost:3000",
      LOG_LEVEL: "info",
      RATE_LIMIT_PER_MINUTE: 120,
      AUTH_RATE_LIMIT_PER_MINUTE: 20,
      TRUST_PROXY_HOPS: 0,
    });
  });

  it("coerces numbers and accepts several web origins", () => {
    const env = parseEnv({
      API_PORT: "8080",
      WEB_ORIGIN: "https://pragya.ai,https://app.pragya.ai",
    });
    expect(env.API_PORT).toBe(8080);
    expect(env.WEB_ORIGIN).toBe("https://pragya.ai,https://app.pragya.ai");
  });

  it("fails fast with the offending variable named", () => {
    expect(() => parseEnv({ API_PORT: "not-a-port" })).toThrow(/API_PORT/);
    expect(() => parseEnv({ WEB_ORIGIN: "not a url" })).toThrow(/WEB_ORIGIN/);
    expect(() => parseEnv({ LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
