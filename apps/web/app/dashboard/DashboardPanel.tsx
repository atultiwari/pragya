"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardView } from "@/components/dashboard/DashboardView";
import type { Overview } from "@/lib/dashboard";
import { browserApi, errorCode } from "@/lib/trpc";

type State =
  | { kind: "loading" }
  | { kind: "ready"; overview: Overview }
  | { kind: "signed-out" }
  | { kind: "error" };

/** Loads in the browser: the API's session cookie never reaches the web server (D-011, D-022). */
export function DashboardPanel() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    browserApi.dashboard.overview
      .query()
      .then((overview) => !cancelled && setState({ kind: "ready", overview }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ kind: errorCode(error) === "UNAUTHORIZED" ? "signed-out" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  switch (state.kind) {
    case "loading":
      return <p className="muted">Loading your progress…</p>;
    case "signed-out":
      return (
        <p>
          <Link href="/sign-in">Sign in</Link> to see your courses and progress.
        </p>
      );
    case "error":
      return (
        <p role="alert" className="form-error">
          Your dashboard could not be loaded. Please try again.
        </p>
      );
    case "ready":
      return <DashboardView overview={state.overview} />;
  }
}
