export type CompletionState = "loading" | "complete" | "incomplete" | "error";

interface CompletionToggleProps {
  readonly state: CompletionState;
  readonly busy: boolean;
  readonly onChange: (completed: boolean) => void;
}

/** The "Mark as complete" control at the end of a lesson. */
export function CompletionToggle({ state, busy, onChange }: CompletionToggleProps) {
  if (state === "loading") return null;
  return (
    <div className="completion" aria-live="polite">
      {state === "error" ? (
        <p role="alert" className="form-error">
          Could not save your progress. Please try again.
        </p>
      ) : null}
      {state === "complete" ? (
        <>
          <p className="status status-online">Lesson complete</p>
          <button
            type="button"
            className="link-button"
            disabled={busy}
            onClick={() => onChange(false)}
          >
            Mark as not complete
          </button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => onChange(true)}>
          {busy ? "Saving…" : "Mark as complete"}
        </button>
      )}
    </div>
  );
}
