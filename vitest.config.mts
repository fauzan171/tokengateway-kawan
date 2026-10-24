import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Next keeps "jsx": "preserve" in tsconfig; oxc must still compile JSX for the test run.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    css: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    passWithNoTests: true,
  },
});
