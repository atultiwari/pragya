import { describe, expect, it, vi } from "vitest";
import { getApiStatus } from "./api-status";

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("getApiStatus", () => {
  it("is online when /health returns the ok envelope", async () => {
    const fetchFn = respond(200, { success: true, data: { status: "ok" }, error: null });
    expect(await getApiStatus("http://api.test", fetchFn)).toBe("online");
    expect(fetchFn).toHaveBeenCalledWith(
      "http://api.test/health",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("is degraded on a non-2xx response", async () => {
    expect(await getApiStatus("http://api.test", respond(503, {}))).toBe("degraded");
  });

  it("is degraded on an unexpected body", async () => {
    expect(await getApiStatus("http://api.test", respond(200, { hello: "world" }))).toBe(
      "degraded",
    );
  });

  it("is offline when the request fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await getApiStatus("http://api.test", fetchFn)).toBe("offline");
  });

  it("is offline when no API URL is configured", async () => {
    expect(await getApiStatus(undefined, respond(200, {}))).toBe("offline");
  });
});
