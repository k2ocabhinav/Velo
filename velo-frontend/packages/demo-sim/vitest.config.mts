import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    // State-machine tests drive fake clocks and can exceed the default timeout
    // when the suite runs alongside other heavy builds on the same machine.
    testTimeout: 20000,
  },
});
