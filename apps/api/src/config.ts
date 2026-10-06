import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Configurazione dalle variabili d'ambiente, controllata all'avvio. In sviluppo legge anche il file
// .env nella radice del repository (vedi .env.example); in produzione le imposta Render.

export interface Config {
  databaseUrl: string;
  porta: number;
  produzione: boolean;
}

const FILE_ENV = fileURLToPath(new URL("../../../.env", import.meta.url));

export function leggiConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env && env.NODE_ENV !== "production" && existsSync(FILE_ENV)) process.loadEnvFile(FILE_ENV);
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Manca DATABASE_URL (in sviluppo: copia .env.example in .env).");
  const porta = Number(env.PORT ?? 3100);
  if (!Number.isInteger(porta) || porta <= 0) throw new Error(`PORT non valida: ${env.PORT}`);
  return { databaseUrl, porta, produzione: env.NODE_ENV === "production" };
}
