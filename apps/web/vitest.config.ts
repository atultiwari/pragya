import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  // Mirror tsconfig's "@/*" path alias used by Next.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    coverage: {
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: [
        "lib/**/*.test.ts",
        "components/**/*.test.tsx",
        "lib/auth-client.ts",
        "lib/trpc.ts",
        // Network/effect-driven; verified end to end in the browser (see PR test plan).
        "components/practice/QuestionCard.tsx",
        "components/practice/PracticeQuiz.tsx",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
