export type ApiStatus = "online" | "degraded" | "offline";

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const HEALTH_TIMEOUT_MS = 2000;

const isHealthyEnvelope = (body: unknown): boolean =>
  typeof body === "object" && body !== null && "success" in body && body.success === true;

/** Checks the API's /health endpoint; never throws, so pages render even when the API is down. */
export async function getApiStatus(
  apiUrl: string | undefined,
  fetchFn: FetchFn = fetch,
): Promise<ApiStatus> {
  if (!apiUrl) return "offline";
  try {
    const res = await fetchFn(`${apiUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return "degraded";
    return isHealthyEnvelope(await res.json()) ? "online" : "degraded";
  } catch {
    return "offline";
  }
}
