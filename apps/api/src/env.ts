import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const envSchema = z.object({
  /** Required by the running API (src/app.ts); optional so unit tests need no database. */
  DATABASE_URL: z.string().min(1).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  /** Comma-separated list of browser origins allowed by CORS. */
  WEB_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .refine(
      (value) => value.split(",").every((origin) => URL.canParse(origin.trim())),
      "must be URL(s)",
    ),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  /** Per-IP limit for /api/auth/* (sign-in, sign-up, OTP), stricter than the global one. */
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  /** Reverse-proxy hops in front of the API. 0 ignores X-Forwarded-For so clients cannot spoof their IP. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid environment: ${problems.join("; ")}`);
  }
  return result.data;
}
