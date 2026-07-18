import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Dummy secrets so src/lib/server/env.ts validation passes under Vitest.
    // No test issues a real query, so the connection string is never used.
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      BETTER_AUTH_SECRET: "test-better-auth-secret",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws unless the bundler sets the react-server condition
      // (which Vitest doesn't); stub it so tests can import server modules.
      "server-only": path.resolve(__dirname, "src/test-utils/server-only-stub.ts"),
    },
  },
});
