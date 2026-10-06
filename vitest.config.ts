import { defineConfig } from "vitest/config";

// Un progetto per pacchetto: le regole sono pure, l'api usa PostgreSQL (vedi apps/api/test/database.ts).
export default defineConfig({
  test: {
    projects: [
      { test: { name: "regole", include: ["packages/regole/src/**/*.test.ts"] } },
      {
        test: {
          name: "api",
          include: ["apps/api/test/**/*.test.ts"],
          globalSetup: ["apps/api/test/globalSetup.ts"],
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
