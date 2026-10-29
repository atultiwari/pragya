import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Create your account · Pragya" };

export default function SignUpPage() {
  return (
    <main className="page auth-page">
      <h1>Create your account</h1>
      <p className="lede">
        Start with free preview lessons. You can buy courses or join your institute later.
      </p>
      <SignUpForm />
      <p className="auth-switch">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </main>
  );
}
