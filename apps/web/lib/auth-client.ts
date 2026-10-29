"use client";

import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

/** Browser client for the API's /api/auth endpoints; sends the session cookie cross-origin. */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  basePath: "/api/auth",
  fetchOptions: { credentials: "include" },
  plugins: [phoneNumberClient()],
});

const FALLBACK_ERROR = "Something went wrong. Please try again.";

/** Better Auth returns `{ error: { message } }`; show its message or a safe fallback. */
export const authErrorMessage = (error: { message?: string | undefined } | null): string =>
  error?.message?.trim() || FALLBACK_ERROR;
