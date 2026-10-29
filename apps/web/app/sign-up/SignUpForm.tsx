"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { validateSignUp, type FieldErrors } from "@/lib/auth-forms";
import { Field, FormError } from "../components/Field";

type SignUpField = "name" | "email" | "password" | "confirm";

const formValues = (form: HTMLFormElement): Record<string, string> =>
  Object.fromEntries(Array.from(new FormData(form), ([key, value]) => [key, String(value)]));

export function SignUpForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<SignUpField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateSignUp(formValues(event.currentTarget));
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const { error } = await authClient.signUp.email(result.data);
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
      <Field name="name" label="Full name" autoComplete="name" error={errors.name} />
      <Field name="email" label="Email" type="email" autoComplete="email" error={errors.email} />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        error={errors.password}
      />
      <Field
        name="confirm"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirm}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
