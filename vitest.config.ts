import { defineConfig } from "vitest/config";

// Un progetto per pacchetto: le regole sono pure, l'api usa l'archivio.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "regole", include: ["packages/regole/src/**/*.test.ts"] } },
      { test: { name: "api", include: ["apps/api/test/**/*.test.ts"] } },
    ],
  },
});
