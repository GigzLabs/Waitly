import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { WAITLY_DATA_DIR: path.resolve(import.meta.dirname, ".vitest-data") },
  },
});
