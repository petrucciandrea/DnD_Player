import { daJSON } from "@dnd/regole/scheda.ts";
import { riga, transazione, type Esecutore } from "./db.ts";
import { creaPersonaggio } from "./personaggi.ts";

// Import dell'esportazione dell'archivio SQLite (apps/api/scripts/esportaSqlite.ts) in un database vuoto.
// Utenti e personaggi conservano id, hash delle password, revisioni e date: le copie locali dei browser
// (localStorage, per id) restano allineate e le password continuano a valere.

export interface Esportazione {
  versione: 1;
  utenti: { id: number; username: string; hash: string; creato: string }[];
  personaggi: { id: number; utenteId: number; revisione: number; aggiornato: string; dati: unknown }[];
}

export function leggiEsportazione(json: unknown): Esportazione {
  const e = json as Partial<Esportazione> | null;
  if (!e || e.versione !== 1 || !Array.isArray(e.utenti) || !Array.isArray(e.personaggi)) {
    throw new Error("Esportazione non valida: serve il file prodotto da esportaSqlite.ts (versione 1).");
  }
  return e as Esportazione;
}

export async function importa(db: Esecutore, esportazione: Esportazione) {
  return transazione(db, async t => {
    const utentiPresenti = Number((await riga(t, "SELECT count(*)::int AS n FROM utenti"))?.n);
    if (utentiPresenti > 0) throw new Error(`Il database ha già ${utentiPresenti} utenti: l'import va fatto su un archivio vuoto.`);
    for (const u of esportazione.utenti) {
      if (!/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/.test(u.hash)) throw new Error(`Hash non valido per l'utente ${u.username}`);
      await t.query("INSERT INTO utenti (id, username, hash, creato) VALUES ($1, $2, $3, $4)", [u.id, u.username, u.hash, new Date(u.creato)]);
    }
    for (const p of esportazione.personaggi) {
      await creaPersonaggio(t, p.utenteId, daJSON(p.dati), p.revisione, { id: p.id, aggiornato: new Date(p.aggiornato) });
    }
    // Le identità ripartono dopo gli id importati.
    for (const tabella of ["utenti", "personaggi"]) {
      await t.query(`
        SELECT setval(pg_get_serial_sequence('${tabella}', 'id'), coalesce(max(id), 1), max(id) IS NOT NULL) FROM ${tabella}
      `);
    }
    return { utenti: esportazione.utenti.length, personaggi: esportazione.personaggi.length };
  });
}
