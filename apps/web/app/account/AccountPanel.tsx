"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AccountPanel() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <p className="muted">Loading your account…</p>;
  if (!session) {
    return (
      <p>
        You are not signed in. <Link href="/sign-in">Sign in</Link>
      </p>
    );
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/");
  }

  return (
    <div className="card">
      <h2>{session.user.name}</h2>
      <p className="muted">
        {session.user.email.endsWith("@phone.pragya.invalid")
          ? "Signed in with mobile"
          : session.user.email}
      </p>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
