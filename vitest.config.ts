import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests for pure logic (game rules, scoring, registries). No DOM, no network. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
