import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "harness/**/*.test.ts"],
    environment: "node",
  },
});
