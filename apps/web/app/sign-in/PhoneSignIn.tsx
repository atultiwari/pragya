"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { validateOtp, validatePhone } from "@/lib/auth-forms";
import { Field, FormError } from "../components/Field";

/** Two steps: send an OTP to the number, then verify it (this also creates new accounts). */
export function PhoneSignIn() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validatePhone({ phone: String(new FormData(event.currentTarget).get("phone")) });
    if (!result.ok) return setFieldError(result.errors.phone);
    setFieldError(undefined);
    setFormError(null);
    setPending(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: result.data.phone });
    setPending(false);
    if (error) return setFormError(authErrorMessage(error));
    setPhone(result.data.phone);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phone === null) return;
    const result = validateOtp({ code: String(new FormData(event.currentTarget).get("code")) });
    if (!result.ok) return setFieldError(result.errors.code);
    setFieldError(undefined);
    setFormError(null);
    setPending(true);
    const { error } = await authClient.phoneNumber.verify({
      phoneNumber: phone,
      code: result.data.code,
    });
    setPending(false);
    if (error) return setFormError(authErrorMessage(error));
    router.push("/account");
  }

  if (phone === null) {
    return (
      <form onSubmit={sendCode} noValidate className="auth-form">
        <FormError message={formError} />
        <Field
          name="phone"
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          error={fieldError}
        />
        <button type="submit" disabled={pending}>
          {pending ? "Sending code…" : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} noValidate className="auth-form">
      <FormError message={formError} />
      <p className="muted">We sent a 6-digit code to {phone}.</p>
      <Field
        name="code"
        label="Code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={fieldError}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Verifying…" : "Verify and continue"}
      </button>
      <button type="button" className="link-button" onClick={() => setPhone(null)}>
        Use a different number
      </button>
    </form>
  );
}
