import { readFileSync } from "node:fs";
import { leggiConfig } from "../src/config.ts";
import { creaPool } from "../src/db.ts";
import { importa, leggiEsportazione } from "../src/importa.ts";

// Uso: npm run importa -w @dnd/api -- <esportazione.json>
// Carica utenti e personaggi esportati dall'archivio SQLite nel database di DATABASE_URL (vuoto,
// già migrato e seminato).
const file = process.argv[2];
if (!file) throw new Error("Indica il file: npm run importa -w @dnd/api -- archivio/esportazione.json");
const esportazione = leggiEsportazione(JSON.parse(readFileSync(file, "utf8")));
const pool = creaPool(leggiConfig().databaseUrl, { max: 1 });
try {
  const esito = await importa(pool, esportazione);
  console.info(`Importati ${esito.utenti} utenti e ${esito.personaggi} personaggi.`);
} finally {
  await pool.end();
}
