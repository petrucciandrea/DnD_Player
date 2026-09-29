import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CharacterData } from "../src/tipi.ts";
import { componi, diUtente, scomponi } from "./personaggi.ts";
import { preparaSchema } from "./schema.ts";
import { transazione } from "./transazione.ts";

// Archivio SQLite: apertura e accesso alle schede con concorrenza ottimistica.
// Ogni personaggio ha una revisione che cresce a ogni scrittura: due dispositivi non
// si sovrascrivono a vicenda senza accorgersene.

export interface Versione {
  dati: CharacterData;
  revisione: number;
}

export type EsitoScrittura =
  | { ok: true; revisione: number }
  | { ok: false; attuale: Versione }
  | { ok: false; attuale: null }; // personaggio inesistente o di un altro utente

export function apriArchivio(percorso: string): DatabaseSync {
  if (percorso !== ":memory:") mkdirSync(dirname(percorso), { recursive: true });
  const db = new DatabaseSync(percorso);
  db.exec("PRAGMA foreign_keys = ON");
  preparaSchema(db, percorso);
  return db;
}

// null se il personaggio non esiste o non è dell'utente.
export function leggi(db: DatabaseSync, id: number, utenteId: number): Versione | null {
  if (!diUtente(db, id, utenteId)) return null;
  const riga = db.prepare("SELECT revisione FROM personaggi WHERE id = ?").get(id);
  const dati = componi(db, id);
  return riga && dati ? { dati, revisione: Number(riga.revisione) } : null;
}

// Scrive solo se la revisione attesa coincide con quella salvata.
// Altrimenti restituisce la versione attuale, così il client può scegliere quale tenere.
export function scrivi(
  db: DatabaseSync, id: number, utenteId: number, dati: CharacterData, revisioneAttesa: number,
): EsitoScrittura {
  return transazione(db, () => {
    if (!diUtente(db, id, utenteId)) return { ok: false, attuale: null };
    const riga = db.prepare("SELECT revisione FROM personaggi WHERE id = ?").get(id);
    if (Number(riga?.revisione) !== revisioneAttesa) {
      const attuale = leggi(db, id, utenteId);
      return attuale ? { ok: false, attuale } : { ok: false, attuale: null };
    }
    const revisione = revisioneAttesa + 1;
    scomponi(db, id, dati, utenteId);
    db.prepare("UPDATE personaggi SET revisione = ?, aggiornato = ? WHERE id = ?").run(revisione, new Date().toISOString(), id);
    return { ok: true, revisione };
  });
}
