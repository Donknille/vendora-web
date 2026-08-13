import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // Zwei Projekte statt einer Umgebung: die 35 bestehenden Dateien laufen
    // unveraendert unter Node weiter, die neuen Oberflaechentests daneben unter
    // jsdom. Getrennt, weil jsdom fuer die reinen Rechenmodule nur Startzeit
    // kosten wuerde -- und weil ein Test, der DOM braucht, das an seiner Endung
    // zeigen soll.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/__tests__/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/__tests__/**/*.dom.test.tsx"],
          setupFiles: ["./src/test-utils/setupDom.ts"],
        },
      },
    ],
    // Der Vitest-Standard von 5 s misst beim ersten `await import(...)` die
    // Ladezeit des halben Modulgraphen mit. Isoliert kostet der schwerste Pfad
    // (db -> drizzle -> postgres, stripe, storage) ~1,3 s; im Parallellauf über
    // 35 Dateien konkurrieren die Worker um CPU, und der jeweils erste
    // Kaltimport reisst die 5 s. Das war kein Haenger, sondern ein wandernder
    // Fehlschlag -- mal die Webhook-Route, mal `getAuthUserId`, je nachdem, wer
    // zuerst dran war. 20 s sind weit genug weg von der Importzeit und immer
    // noch eng genug, um eine echte Endlosschleife zu fangen.
    testTimeout: 20000,
    // Dummy secrets so src/lib/server/env.ts validation passes under Vitest.
    // No test issues a real query, so the connection string is never used.
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      BETTER_AUTH_SECRET: "test-better-auth-secret",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws unless the bundler sets the react-server condition
      // (which Vitest doesn't); stub it so tests can import server modules.
      "server-only": path.resolve(import.meta.dirname, "src/test-utils/server-only-stub.ts"),
    },
  },
});
