"use client";

import { useEffect, useState } from "react";
import { CompletionToggle, type CompletionState } from "@/components/progress/CompletionToggle";
import { authClient } from "@/lib/auth-client";
import { browserApi } from "@/lib/trpc";

interface MarkCompleteProps {
  readonly courseSlug: string;
  readonly lessonSlug: string;
}

/** Signed-in learners only; guests reading a preview lesson see nothing here. */
export function MarkComplete({ courseSlug, lessonSlug }: MarkCompleteProps) {
  const { data: session } = authClient.useSession();
  const [state, setState] = useState<CompletionState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    browserApi.progress.lesson
      .query({ courseSlug, lessonSlug })
      .then((r) => !cancelled && setState(r.completed ? "complete" : "incomplete"))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [session, courseSlug, lessonSlug]);

  async function change(completed: boolean) {
    setBusy(true);
    try {
      const result = await browserApi.progress.markComplete.mutate({
        courseSlug,
        lessonSlug,
        completed,
      });
      setState(result.completed ? "complete" : "incomplete");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;
  return <CompletionToggle state={state} busy={busy} onChange={change} />;
}
