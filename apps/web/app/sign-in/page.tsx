import type { Metadata } from "next";
import Link from "next/link";
import { SignInTabs } from "./SignInTabs";

export const metadata: Metadata = { title: "Sign in · Pragya" };

export default function SignInPage() {
  return (
    <main className="page auth-page">
      <h1>Sign in</h1>
      <SignInTabs />
      <p className="auth-switch">
        New to Pragya? <Link href="/sign-up">Create an account</Link>
      </p>
    </main>
  );
}
