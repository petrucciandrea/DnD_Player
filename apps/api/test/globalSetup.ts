import { aggiornaCataloghi } from "../src/catalogo.ts";
import { creaPool } from "../src/db.ts";
import { applicaMigrazioni } from "../src/migra.ts";
import { DB_MODELLO, eliminaDatabaseDiProva, eseguiComeAmministratore, urlDatabase } from "./amministrazione.ts";

// Prepara una volta il database modello (migrato e seminato): ogni test ne clona una copia.
export default async function preparaModello() {
  await eseguiComeAmministratore(`DROP DATABASE IF EXISTS ${DB_MODELLO} WITH (FORCE)`, `CREATE DATABASE ${DB_MODELLO}`);
  const pool = creaPool(urlDatabase(DB_MODELLO), { max: 1 });
  try {
    await applicaMigrazioni(pool);
    await aggiornaCataloghi(pool);
  } finally {
    await pool.end();
  }
  return eliminaDatabaseDiProva;
}
