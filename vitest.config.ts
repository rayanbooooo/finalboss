import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests for the pure modules only - the maths, the parsing and the
 * validation that a wrong answer in would show up as real money.
 *
 * Node environment, no jsdom: nothing here touches the DOM, and adding a
 * browser environment would mean every one of these suites paying for it.
 * `lib/exchange/crypto.ts` uses Web Crypto, which Node exposes as
 * `globalThis.crypto` natively, so it needs no shim either.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
