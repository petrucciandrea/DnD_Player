import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { apriArchivio } from "../src/archivio.ts";
import { componi } from "../src/personaggi.ts";

// Esporta utenti (con l'hash della password) e personaggi dall'archivio SQLite, per importarli in PostgreSQL.
// Uso: node scripts/esportaSqlite.ts [archivio.sqlite] [esportazione.json]
const sorgente = resolve(process.argv[2] ?? "archivio/dnd_player.sqlite");
const destinazione = resolve(process.argv[3] ?? "archivio/esportazione.json");

const db = apriArchivio(sorgente);
const utenti = db.prepare("SELECT id, username, hash, creato FROM utenti ORDER BY id").all().map(u => ({
  id: Number(u.id), username: String(u.username), hash: String(u.hash), creato: String(u.creato),
}));
const personaggi = db.prepare("SELECT id, utente_id, revisione, aggiornato FROM personaggi ORDER BY id").all().map(p => ({
  id: Number(p.id), utenteId: Number(p.utente_id), revisione: Number(p.revisione), aggiornato: String(p.aggiornato),
  dati: componi(db, Number(p.id)),
}));
writeFileSync(destinazione, JSON.stringify({ versione: 1, utenti, personaggi }, null, 2));
console.info(`Esportati ${utenti.length} utenti e ${personaggi.length} personaggi in ${destinazione}`);
