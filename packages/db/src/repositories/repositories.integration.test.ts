import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client.js";
import { batchMembers, courses, institutes, streams, users } from "../schema/index.js";
import { createBatchRepository } from "./batches.js";
import { createRoleAssignmentRepository } from "./role-assignments.js";

const DATABASE_URL = process.env.DATABASE_URL;
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

describe.skipIf(!DATABASE_URL)("repositories against MySQL", () => {
  let handle: DbHandle;
  const instituteA = ulid();
  const instituteB = ulid();
  const userId = ulid();

  beforeAll(async () => {
    handle = createDb(DATABASE_URL ?? "");
    await migrate(handle.db, { migrationsFolder });
    await handle.db.insert(institutes).values([
      { id: instituteA, name: "Institute A", slug: `a-${instituteA}` },
      { id: instituteB, name: "Institute B", slug: `b-${instituteB}` },
    ]);
    await handle.db
      .insert(users)
      .values({ id: userId, name: "Test User", email: `${userId}@example.test` });
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("keeps batches inside their institute", async () => {
    const repo = createBatchRepository(handle.db);
    const batch = await repo.create(instituteA, { name: "MBBS 2024 A" });

    expect(await repo.findById(instituteA, batch.id)).toEqual(batch);
    expect(await repo.findById(instituteB, batch.id)).toBeNull();
    expect(await repo.listForInstitute(instituteB)).toEqual([]);
    expect((await repo.listForInstitute(instituteA)).map((b) => b.id)).toEqual([batch.id]);
  });

  it("round-trips role grants and ignores duplicates", async () => {
    const repo = createRoleAssignmentRepository(handle.db);
    await repo.grant({
      userId,
      assignment: { role: "nodal_officer", scope: { type: "institute", id: instituteA } },
    });
    await repo.grant({
      userId,
      assignment: { role: "nodal_officer", scope: { type: "institute", id: instituteA } },
    });
    await repo.grant({ userId, assignment: { role: "tutor", scope: { type: "platform" } } });

    const assignments = await repo.listForUser(userId);
    expect(assignments).toHaveLength(2);
    expect(assignments).toContainEqual({ role: "tutor", scope: { type: "platform" } });
    expect(assignments).toContainEqual({
      role: "nodal_officer",
      scope: { type: "institute", id: instituteA },
    });
  });

  it("rejects a batch member row that names a different institute", async () => {
    const batch = await createBatchRepository(handle.db).create(instituteA, {
      name: `Mismatch ${ulid()}`,
    });
    await expect(
      handle.db.insert(batchMembers).values({ batchId: batch.id, userId, instituteId: instituteB }),
    ).rejects.toThrow();
    await handle.db
      .insert(batchMembers)
      .values({ batchId: batch.id, userId, instituteId: instituteA });
  });

  it("refuses an institute-only course without an institute", async () => {
    const streamId = ulid();
    await handle.db.insert(streams).values({ id: streamId, name: "Test", slug: `s-${streamId}` });
    await expect(
      handle.db
        .insert(courses)
        .values({ streamId, title: "Private", slug: `c-${streamId}`, visibility: "institute" }),
    ).rejects.toThrow();
  });
});
