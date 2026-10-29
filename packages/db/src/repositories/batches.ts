import { and, asc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { z } from "zod";
import type { Database } from "../client.js";
import { batches } from "../schema/index.js";

const createBatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cohort: z.string().trim().min(1).max(60).optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export interface Batch {
  readonly id: string;
  readonly instituteId: string;
  readonly name: string;
  readonly cohort: string | null;
}

/** Validates untrusted input. Unknown keys such as `instituteId` are stripped. */
export function parseCreateBatchInput(input: unknown): CreateBatchInput {
  return createBatchSchema.parse(input);
}

/**
 * Every method takes the institute id from the caller's verified session, so one
 * institute can never read or write another's batches.
 */
export interface BatchRepository {
  listForInstitute(instituteId: string): Promise<readonly Batch[]>;
  findById(instituteId: string, batchId: string): Promise<Batch | null>;
  create(instituteId: string, input: unknown): Promise<Batch>;
}

const batchColumns = {
  id: batches.id,
  instituteId: batches.instituteId,
  name: batches.name,
  cohort: batches.cohort,
};

export function createBatchRepository(db: Database): BatchRepository {
  return {
    async listForInstitute(instituteId) {
      return db
        .select(batchColumns)
        .from(batches)
        .where(eq(batches.instituteId, instituteId))
        .orderBy(asc(batches.name));
    },

    async findById(instituteId, batchId) {
      const [row] = await db
        .select(batchColumns)
        .from(batches)
        .where(and(eq(batches.instituteId, instituteId), eq(batches.id, batchId)))
        .limit(1);
      return row ?? null;
    },

    async create(instituteId, input) {
      const { name, cohort } = parseCreateBatchInput(input);
      const batch: Batch = { id: ulid(), instituteId, name, cohort: cohort ?? null };
      await db.insert(batches).values(batch);
      return batch;
    },
  };
}
