import { leggiConfig } from "../src/config.ts";
import { creaPool } from "../src/db.ts";
import { applicaMigrazioni } from "../src/migra.ts";

// Applica le migrazioni mancanti al database di DATABASE_URL.
const pool = creaPool(leggiConfig().databaseUrl, { max: 1 });
try {
  const applicate = await applicaMigrazioni(pool);
  console.info(applicate.length ? `Migrazioni applicate: ${applicate.join(", ")}` : "Schema già aggiornato.");
} finally {
  await pool.end();
}
