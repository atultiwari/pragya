"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { browserApi } from "@/lib/trpc";

type Access = { enrolled: boolean; canEnrolFree: boolean } | null;

/** The signed-in part of the course page: enrolment state and the enrol button. */
export function CourseAccess({ slug }: { readonly slug: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [access, setAccess] = useState<Access>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const course = await browserApi.catalogue.course.query({ slug });
      setAccess(course.access);
    } catch {
      setError("Could not check your enrolment. Please reload the page.");
    }
  }, [slug]);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  async function enrol() {
    setBusy(true);
    setError(null);
    try {
      await browserApi.enrollment.enrolFree.mutate({ courseSlug: slug });
      await refresh();
    } catch {
      setError("Enrolment failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return null;
  if (!session) {
    return (
      <p className="access">
        <Link href="/sign-in">Sign in</Link> to enrol. Preview lessons are open to everyone.
      </p>
    );
  }
  return (
    <div className="access">
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {access?.enrolled ? <p className="status status-online">You are enrolled</p> : null}
      {access?.canEnrolFree ? (
        <button type="button" onClick={enrol} disabled={busy}>
          {busy ? "Enrolling…" : "Enrol for free"}
        </button>
      ) : null}
      {access && !access.enrolled && !access.canEnrolFree ? (
        <p className="muted">Paid enrolment opens with checkout (coming soon).</p>
      ) : null}
    </div>
  );
}
