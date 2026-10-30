import type { Metadata } from "next";
import { DashboardPanel } from "./DashboardPanel";

export const metadata: Metadata = { title: "Your dashboard · Pragya" };

export default function DashboardPage() {
  return (
    <main className="page">
      <h1>Your dashboard</h1>
      <DashboardPanel />
    </main>
  );
}
