import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/schema/**",
        "src/client.ts",
        "src/migrate.ts",
        "src/cli/seed.ts",
        "src/cli/grant-role.ts",
        "src/seed/**",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
