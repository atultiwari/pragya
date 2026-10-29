import { schema, type Database } from "@pragya/db";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { ulid } from "ulid";
import type { AuthEnv } from "./config.js";
import { isE164, isReservedEmail, phoneTempEmail, type Mailer, type SmsSender } from "./senders.js";

export interface CreateAuthOptions {
  readonly db: Database;
  readonly env: AuthEnv;
  readonly mailer: Mailer;
  readonly sms: SmsSender;
}

const THIRTY_DAYS_S = 60 * 60 * 24 * 30;
const ONE_DAY_S = 60 * 60 * 24;
const OTP_TTL_S = 5 * 60;

/** Endpoints where a user chooses an email address. */
const EMAIL_ENTRY_PATHS = new Set(["/sign-up/email", "/change-email"]);

const emailFromBody = (body: unknown): string | null => {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const value = record.email ?? record.newEmail;
  return typeof value === "string" ? value : null;
};

/** Stops anyone claiming a phone account's placeholder address (number squatting). */
const rejectReservedEmails = createAuthMiddleware(async (ctx) => {
  if (!EMAIL_ENTRY_PATHS.has(ctx.path)) return;
  const email = emailFromBody(ctx.body);
  if (email !== null && isReservedEmail(email)) {
    throw new APIError("BAD_REQUEST", { message: "This email address is reserved" });
  }
});

export function createAuth({ db, env, mailer, sms }: CreateAuthOptions) {
  return betterAuth({
    appName: "Pragya",
    baseURL: env.baseUrl,
    basePath: "/api/auth",
    secret: env.secret,
    trustedOrigins: [...env.trustedOrigins],
    database: drizzleAdapter(db, {
      provider: "mysql",
      usePlural: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
      },
    }),
    advanced: {
      database: { generateId: () => ulid() },
      // Better Auth skips its CSRF/origin check when NODE_ENV=test; keep it on everywhere.
      disableOriginCheck: false,
      // The API bridge overwrites this header with the client address Fastify trusts.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    session: { expiresIn: THIRTY_DAYS_S, updateAge: ONE_DAY_S },
    hooks: { before: rejectReservedEmails },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: env.requireEmailVerification,
      sendResetPassword: async ({ user, url }) =>
        mailer.send({
          to: user.email,
          subject: "Reset your Pragya password",
          text: `Reset it here: ${url}`,
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) =>
        mailer.send({
          to: user.email,
          subject: "Verify your Pragya email",
          text: `Verify it here: ${url}`,
        }),
    },
    socialProviders: env.google ? { google: { ...env.google } } : {},
    plugins: [
      phoneNumber({
        otpLength: 6,
        expiresIn: OTP_TTL_S,
        allowedAttempts: 3,
        phoneNumberValidator: isE164,
        sendOTP: ({ phoneNumber: phone, code }) => sms.sendOtp(phone, code),
        signUpOnVerification: { getTempEmail: phoneTempEmail, getTempName: (phone) => phone },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** The signed-in user's id for a request, or null for guests and expired sessions. */
export async function getSessionUserId(auth: Auth, headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
