import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const authEnvSchema = z
  .object({
    /** Signs session cookies and tokens. Generate with `openssl rand -base64 48`. */
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    /** Public base URL of the API that serves /api/auth. */
    BETTER_AUTH_URL: z.url(),
    WEB_ORIGIN: z.string().default("http://localhost:3000"),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    AUTH_REQUIRE_EMAIL_VERIFICATION: booleanString.optional(),
    /** Opt-in to log-only mail/SMS senders (local dev). Never allowed in production. */
    AUTH_DEV_SENDERS: booleanString.optional(),
    NODE_ENV: z.string().optional(),
  })
  .refine(
    (env) => (env.GOOGLE_CLIENT_ID === undefined) === (env.GOOGLE_CLIENT_SECRET === undefined),
    {
      message: "set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
      path: ["GOOGLE_CLIENT_SECRET"],
    },
  );

export interface AuthEnv {
  readonly secret: string;
  readonly baseUrl: string;
  readonly trustedOrigins: readonly string[];
  readonly requireEmailVerification: boolean;
  readonly google: { readonly clientId: string; readonly clientSecret: string } | null;
  readonly isProduction: boolean;
  readonly devSenders: boolean;
}

/** `KEY=` in a .env file means "not set", not "set to an empty string". */
const withoutEmptyValues = (source: Record<string, string | undefined>) =>
  Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ""),
  );

export function parseAuthEnv(source: Record<string, string | undefined>): AuthEnv {
  const result = authEnvSchema.safeParse(withoutEmptyValues(source));
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid auth environment: ${problems.join("; ")}`);
  }
  const env = result.data;
  const isProduction = env.NODE_ENV === "production";
  const devSenders = env.AUTH_DEV_SENDERS ?? false;
  if (isProduction && devSenders) {
    throw new Error("Invalid auth environment: AUTH_DEV_SENDERS cannot be true in production");
  }
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseUrl: env.BETTER_AUTH_URL,
    trustedOrigins: env.WEB_ORIGIN.split(",").map((origin) => origin.trim()),
    // Production always verifies email; elsewhere it is opt-in so local sign-up stays quick.
    requireEmailVerification: isProduction || (env.AUTH_REQUIRE_EMAIL_VERIFICATION ?? false),
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : null,
    isProduction,
    devSenders,
  };
}
