import { createDb, runMigrations, type DbHandle } from "@pragya/db";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth, getSessionUserId, type Auth } from "./auth.js";
import { parseAuthEnv } from "./config.js";
import type { Mailer, SmsSender } from "./senders.js";

const DATABASE_URL = process.env.DATABASE_URL;

const env = parseAuthEnv({
  BETTER_AUTH_SECRET: "test-secret-".padEnd(40, "x"),
  BETTER_AUTH_URL: "http://localhost:4000",
  WEB_ORIGIN: "http://localhost:3000",
  AUTH_DEV_SENDERS: "true",
});

const cookieFrom = (headers: Headers): string =>
  headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

describe.skipIf(!DATABASE_URL)("Better Auth against MySQL", () => {
  let handle: DbHandle;
  let auth: Auth;
  const mail: { to: string; subject: string }[] = [];
  const otps = new Map<string, string>();
  const mailer: Mailer = { send: async (m) => void mail.push(m) };
  const sms: SmsSender = { sendOtp: async (phone, code) => void otps.set(phone, code) };

  beforeAll(async () => {
    handle = createDb(DATABASE_URL ?? "");
    await runMigrations(handle.db);
    auth = createAuth({ db: handle.db, env, mailer, sms });
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("signs up with email, stores a ULID user and sends a verification email", async () => {
    const email = `${ulid().toLowerCase()}@example.test`;
    const res = await auth.api.signUpEmail({
      body: { email, password: "correct horse battery", name: "Asha" },
    });
    expect(res.user.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(mail.some((m) => m.to === email)).toBe(true);
  });

  it("signs in and resolves the session from the cookie", async () => {
    const email = `${ulid().toLowerCase()}@example.test`;
    const password = "another strong pass";
    const signUp = await auth.api.signUpEmail({ body: { email, password, name: "Ravi" } });
    const signIn = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    const headers = new Headers({ cookie: cookieFrom(signIn.headers) });
    expect(await getSessionUserId(auth, headers)).toBe(signUp.user.id);
  });

  it("rejects a wrong password", async () => {
    const email = `${ulid().toLowerCase()}@example.test`;
    await auth.api.signUpEmail({ body: { email, password: "right password!", name: "Meera" } });
    await expect(
      auth.api.signInEmail({ body: { email, password: "wrong password!" } }),
    ).rejects.toThrow();
  });

  it.each(["919800000000@phone.pragya.invalid", "anyone@squat.invalid"])(
    "refuses email sign-up with reserved address %s",
    async (email) => {
      await expect(
        auth.api.signUpEmail({
          body: { email, password: "long enough password", name: "Squatter" },
        }),
      ).rejects.toThrow(/reserved/i);
    },
  );

  it("rejects a password shorter than 10 characters", async () => {
    const email = `${ulid().toLowerCase()}@example.test`;
    await expect(
      auth.api.signUpEmail({ body: { email, password: "short", name: "X" } }),
    ).rejects.toThrow();
  });

  it("signs up by phone OTP", async () => {
    const phoneNumber = `+9190${String(Date.now()).slice(-8)}`;
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber } });
    const code = otps.get(phoneNumber);
    expect(code).toMatch(/^\d{6}$/);
    const verified = await auth.api.verifyPhoneNumber({
      body: { phoneNumber, code: code ?? "" },
      returnHeaders: true,
    });
    const userId = await getSessionUserId(
      auth,
      new Headers({ cookie: cookieFrom(verified.headers) }),
    );
    expect(userId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("rejects an invalid phone number before sending an OTP", async () => {
    await expect(auth.api.sendPhoneNumberOTP({ body: { phoneNumber: "12345" } })).rejects.toThrow();
  });

  it("returns null for a request with no session", async () => {
    expect(await getSessionUserId(auth, new Headers())).toBeNull();
  });
});
