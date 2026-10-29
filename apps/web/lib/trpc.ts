import type { AppRouter } from "@pragya/api";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Browser client: sends the session cookie to the API. */
export const browserApi = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
    }),
  ],
});

/** Server-component client for public data (no cookies; renders the guest view for SEO). */
export const publicApi = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    }),
  ],
});

export const errorCode = (error: unknown): string | null =>
  error instanceof TRPCClientError
    ? ((error.data as { code?: string } | undefined)?.code ?? null)
    : null;

/** The API serves a course's figures, checking the learner's access (D-023); cookies go with the <img>. */
export const contentAssetBase = (courseSlug: string): string => `${API_URL}/content/${courseSlug}`;
