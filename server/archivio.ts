import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { preparaAccesso } from "./accesso.ts";

// Archivio SQLite delle schede: una riga per personaggio, con il JSON della scheda
// e una revisione che cresce a ogni scrittura (concorrenza ottimistica tra dispositivi).

export interface Versione {
  dati: unknown;
  revisione: number;
}

export type EsitoScrittura =
  | { ok: true; revisione: number }
  | { ok: false; attuale: Versione | null };

export function apriArchivio(percorso: string): DatabaseSync {
  if (percorso !== ":memory:") mkdirSync(dirname(percorso), { recursive: true });
  const db = new DatabaseSync(percorso);
  db.exec(`
    CREATE TABLE IF NOT EXISTS personaggi (
      id TEXT PRIMARY KEY,
      dati TEXT NOT NULL,
      revisione INTEGER NOT NULL,
      aggiornato TEXT NOT NULL
    )
  `);
  preparaAccesso(db);
  return db;
}

export function leggi(db: DatabaseSync, id: string): Versione | null {
  const riga = db.prepare("SELECT dati, revisione FROM personaggi WHERE id = ?").get(id);
  if (!riga) return null;
  return { dati: JSON.parse(String(riga.dati)), revisione: Number(riga.revisione) };
}

// Scrive solo se la revisione attesa coincide con quella salvata (0 = personaggio ancora assente).
// Altrimenti restituisce la versione attuale, così il client può scegliere quale tenere.
export function scrivi(db: DatabaseSync, id: string, dati: unknown, revisioneAttesa: number): EsitoScrittura {
  const attuale = leggi(db, id);
  if ((attuale?.revisione ?? 0) !== revisioneAttesa) return { ok: false, attuale };
  const revisione = revisioneAttesa + 1;
  db.prepare(`
    INSERT INTO personaggi (id, dati, revisione, aggiornato) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET dati = excluded.dati, revisione = excluded.revisione, aggiornato = excluded.aggiornato
  `).run(id, JSON.stringify(dati), revisione, new Date().toISOString());
  return { ok: true, revisione };
}
