import { z } from "zod";

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type Validation<T, K extends string> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly errors: FieldErrors<K> };

const MIN_PASSWORD = 10;
const MAX_PASSWORD = 128;
const DEFAULT_COUNTRY_CODE = "91";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(120, "Use at most 120 characters"),
    email,
    password: z
      .string()
      .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`)
      .max(MAX_PASSWORD, `Use at most ${MAX_PASSWORD} characters`),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

/**
 * Turns what people type into E.164. Ten-digit numbers (optionally with a leading 0)
 * are taken as Indian mobiles; anything else must already carry a +country code.
 */
export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  const candidate = trimmed.startsWith("+")
    ? `+${digits}`
    : /^0?\d{10}$/.test(digits)
      ? `+${DEFAULT_COUNTRY_CODE}${digits.slice(-10)}`
      : null;
  return candidate !== null && /^\+[1-9]\d{6,14}$/.test(candidate) ? candidate : null;
}

const phoneSchema = z.object({
  phone: z.string().transform((value, ctx) => {
    const phone = normalisePhone(value);
    if (phone === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number" });
      return z.NEVER;
    }
    return phone;
  }),
});

const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

function validate<S extends z.ZodType>(schema: S, input: unknown): Validation<z.output<S>, string> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return { ok: false, errors };
}

export interface SignUpData {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export function validateSignUp(
  input: Record<string, string>,
): Validation<SignUpData, "name" | "email" | "password" | "confirm"> {
  const result = validate(signUpSchema, input);
  if (!result.ok) return result;
  const { name, email: address, password } = result.data;
  return { ok: true, data: { name, email: address, password } };
}

export const validateSignIn = (input: Record<string, string>) =>
  validate(signInSchema, input) as Validation<z.output<typeof signInSchema>, "email" | "password">;

export const validatePhone = (input: Record<string, string>) =>
  validate(phoneSchema, input) as Validation<{ phone: string }, "phone">;

export const validateOtp = (input: Record<string, string>) =>
  validate(otpSchema, input) as Validation<{ code: string }, "code">;
