import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/frontend/**/*.test.ts", "tests/server/**/*.test.ts"]
  }
})
