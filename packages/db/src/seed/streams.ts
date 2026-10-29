import type { StreamSeed } from "../repositories/streams.js";

/** Launch streams (PLAN.md §1). New streams are added here and re-seeded. */
export const LAUNCH_STREAMS: readonly StreamSeed[] = [
  { slug: "mbbs", name: "MBBS", sortOrder: 10 },
  { slug: "healthcare-ai", name: "Healthcare AI", sortOrder: 20 },
];
