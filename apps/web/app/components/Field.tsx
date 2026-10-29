import type { InputHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly name: string;
  readonly label: string;
  readonly error?: string | undefined;
}

export function Field({ name, label, error, ...input }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { readonly message: string | null }) {
  return message ? (
    <p role="alert" className="form-error">
      {message}
    </p>
  ) : null;
}
