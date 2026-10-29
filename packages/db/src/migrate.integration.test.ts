import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "./client.js";
import { runMigrations, withAdvisoryLock } from "./migrate.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!DATABASE_URL)("migrations under concurrency", () => {
  let handle: DbHandle;

  beforeAll(() => {
    handle = createDb(DATABASE_URL ?? "");
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("serialises work holding the same advisory lock", async () => {
    const events: string[] = [];
    const job = (name: string) =>
      withAdvisoryLock(handle.pool, "pragya_test_lock", async () => {
        events.push(`${name}:start`);
        await pause(50);
        events.push(`${name}:end`);
      });
    await Promise.all([job("a"), job("b")]);
    expect(events).toHaveLength(4);
    expect(events[1]).toBe(`${events[0]?.split(":")[0]}:end`);
  });

  it("lets several processes migrate at once without racing", async () => {
    const others = [createDb(DATABASE_URL ?? ""), createDb(DATABASE_URL ?? "")];
    try {
      await Promise.all([handle, ...others].map((h) => runMigrations(h)));
    } finally {
      await Promise.all(others.map((h) => h.close()));
    }
  });

  it("releases the lock when the work fails", async () => {
    await expect(
      withAdvisoryLock(handle.pool, "pragya_test_lock", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(withAdvisoryLock(handle.pool, "pragya_test_lock", async () => "ok")).resolves.toBe(
      "ok",
    );
  });
});
