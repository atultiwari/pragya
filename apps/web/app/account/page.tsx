import type { Metadata } from "next";
import { AccountPanel } from "./AccountPanel";

export const metadata: Metadata = { title: "Your account · Pragya" };

export default function AccountPage() {
  return (
    <main className="page auth-page">
      <h1>Your account</h1>
      <AccountPanel />
    </main>
  );
}
