import path from "node:path"
import { defineConfig } from "vitest/config"

const root = import.meta.dirname

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    setupFiles: ["dotenv/config"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // Next.js's "server-only" marker throws when imported outside its RSC
      // bundler. Plain Vitest has no such bundler, so we no-op it here —
      // the marker's only job is a dev-time guard against client bundling.
      "server-only": path.resolve(root, "tests/support/server-only-stub.ts"),
    },
  },
})
