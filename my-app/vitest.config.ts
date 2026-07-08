import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./lib/test/setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    pool: "forks",
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/api/**", "store/**", "lib/config/**"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/__contracts__.md"],
      thresholds: {
        statements: 72,
        branches: 75,
        functions: 60,
        lines: 72,
      },
    },
  },
});
