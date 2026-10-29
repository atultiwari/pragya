"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { validateSignIn, type FieldErrors } from "@/lib/auth-forms";
import { Field, FormError } from "../components/Field";

export function EmailSignIn() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = validateSignIn({
      email: String(data.get("email")),
      password: String(data.get("password")),
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const { error } = await authClient.signIn.email(result.data);
    setPending(false);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    router.push("/account");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="auth-form">
      <FormError message={formError} />
      <Field name="email" label="Email" type="email" autoComplete="email" error={errors.email} />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
