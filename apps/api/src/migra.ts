import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Esecutore } from "./db.ts";
import { riga, righe, transazione } from "./db.ts";

// Migrazioni dello schema: file SQL numerati in apps/api/migrazioni (001_schema.sql, 002_…),
// applicati in ordine una sola volta. Ogni file gira in una transazione con la sua registrazione.
// Le migrazioni devono essere compatibili con il codice in esecuzione: il deploy le applica
// prima di aggiornare il server, quindi si aggiungono colonne e tabelle e si tolgono solo dopo.

export const CARTELLA_MIGRAZIONI = fileURLToPath(new URL("../migrazioni/", import.meta.url));
const BLOCCO = 4_202_502; // chiave di pg_advisory_lock: due deploy insieme non migrano due volte

export const elencoMigrazioni = (cartella = CARTELLA_MIGRAZIONI) =>
  readdirSync(cartella).filter(f => /^\d{3}_[\w-]+\.sql$/.test(f)).sort();

// Applica le migrazioni mancanti e restituisce i nomi di quelle applicate.
export async function applicaMigrazioni(db: Esecutore, cartella = CARTELLA_MIGRAZIONI): Promise<string[]> {
  return transazione(db, async client => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [BLOCCO]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrazioni_applicate (
        nome text PRIMARY KEY,
        applicata timestamptz NOT NULL DEFAULT now()
      )
    `);
    const fatte = new Set((await righe(client, "SELECT nome FROM migrazioni_applicate")).map(r => String(r.nome)));
    const applicate: string[] = [];
    for (const nome of elencoMigrazioni(cartella)) {
      if (fatte.has(nome)) continue;
      await transazione(client, async t => {
        await t.query(readFileSync(`${cartella}/${nome}`, "utf8"));
        await t.query("INSERT INTO migrazioni_applicate (nome) VALUES ($1)", [nome]);
      });
      applicate.push(nome);
    }
    return applicate;
  });
}

// Ultima migrazione applicata, o null su un database vuoto.
export async function versioneSchema(db: Esecutore): Promise<string | null> {
  const esiste = await riga(db, "SELECT to_regclass('migrazioni_applicate') AS t");
  if (!esiste?.t) return null;
  const r = await riga(db, "SELECT max(nome) AS nome FROM migrazioni_applicate");
  return r?.nome ? String(r.nome) : null;
}
