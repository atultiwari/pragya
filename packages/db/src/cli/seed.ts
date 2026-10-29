import { createDb } from "../client.js";
import { runMigrations } from "../migrate.js";
import { upsertStreams } from "../repositories/streams.js";
import { LAUNCH_STREAMS } from "../seed/streams.js";

/** `pnpm --filter @pragya/db seed` — migrates, then upserts reference data. Idempotent. */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const handle = createDb(databaseUrl);
try {
  await runMigrations(handle.db);
  await upsertStreams(handle.db, LAUNCH_STREAMS);
  console.warn(`Seeded ${LAUNCH_STREAMS.length} streams`);
} catch (error: unknown) {
  console.error("Seeding failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
