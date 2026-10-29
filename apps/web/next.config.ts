import type { NextConfig } from "next";

/** Load the monorepo's root .env in development; production injects real environment variables. */
function loadRootEnv(): void {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch (error: unknown) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    if (!missing) throw error;
  }
}

loadRootEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
