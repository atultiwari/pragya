import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    coverage: {
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: [
        "lib/**/*.test.ts",
        "components/**/*.test.tsx",
        "lib/auth-client.ts",
        "lib/trpc.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
