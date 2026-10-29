/** Launch catalogue shown on the landing page until the catalogue API ships in Phase 1. */
export interface StreamPreview {
  readonly slug: string;
  readonly name: string;
  readonly courses: readonly string[];
  readonly status: "launching" | "planned";
}

export const LAUNCH_STREAMS: readonly StreamPreview[] = [
  {
    slug: "mbbs",
    name: "MBBS",
    courses: ["AI-powered Pathology"],
    status: "launching",
  },
  {
    slug: "healthcare-ai",
    name: "Healthcare AI",
    courses: ["AI in Healthcare"],
    status: "planned",
  },
  {
    slug: "more",
    name: "More streams",
    courses: ["Non-medical courses from independent tutors and institutes"],
    status: "planned",
  },
];
