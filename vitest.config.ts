import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Minimal Vitest setup for pure helper tests. Does not pull in jsdom or React
 * Testing Library — those come later when a component actually needs them.
 * React Server Component and Prisma-backed code is NOT yet covered by these
 * tests; E2E Playwright scripts in /e2e remain the integration layer.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
