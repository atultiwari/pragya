import type { browserApi } from "@/lib/trpc";

export type Overview = Awaited<ReturnType<typeof browserApi.dashboard.overview.query>>;
export type DashboardCourse = Overview["courses"][number];

/** Whole-number share of lessons completed; 0 for a course with no lessons yet. */
export function completionPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

/** "75%" for graded practice, an em dash when nothing has been graded yet. */
export function formatAccuracy(accuracy: number | null): string {
  return accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`;
}

const DAY_MS = 86_400_000;
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/** Calendar-day distance in the viewer's time zone: "today", "yesterday", "3 days ago", "12 Oct". */
export function formatLastActive(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return shortDate.format(then);
}

/** Lesson-reader paths are built from API slugs; encode them so a slug can never alter the path. */
export const lessonHref = (courseSlug: string, lessonSlug: string): string =>
  `/courses/${encodeURIComponent(courseSlug)}/${encodeURIComponent(lessonSlug)}`;

export const courseHref = (courseSlug: string): string =>
  `/courses/${encodeURIComponent(courseSlug)}`;
