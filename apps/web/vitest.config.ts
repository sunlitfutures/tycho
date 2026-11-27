import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.join(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
