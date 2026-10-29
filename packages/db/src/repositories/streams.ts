import { sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { streams } from "../schema/index.js";

export interface StreamSeed {
  readonly slug: string;
  readonly name: string;
  readonly sortOrder: number;
}

/** Inserts streams or updates them in place by slug; safe to re-run. */
export async function upsertStreams(db: Database, seeds: readonly StreamSeed[]): Promise<void> {
  if (seeds.length === 0) return;
  await db
    .insert(streams)
    .values(seeds.map((seed) => ({ ...seed })))
    .onDuplicateKeyUpdate({
      set: { name: sql`VALUES(${streams.name})`, sortOrder: sql`VALUES(${streams.sortOrder})` },
    });
}
