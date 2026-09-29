import type { DatabaseSync, SQLInputValue, SQLOutputValue } from "node:sqlite";
import type { Arma, Caratteristica, DettagliIncantesimo, Privilegio } from "../src/tipi.ts";
import { ARMI } from "./semi/armi.ts";
import { SCHEDE_INCANTESIMI } from "./semi/incantesimi.ts";
import { PRIVILEGI } from "./semi/privilegi.ts";

// Cataloghi condivisi: incantesimi, armi e privilegi. Ogni voce ha `creato_da`: NULL per quelle
// ufficiali (dai seed in server/semi), altrimenti l'id dell'utente che l'ha aggiunta.
// Le voci si riconoscono per nome (i privilegi per nome + fonte), senza distinguere le maiuscole.

type Riga = Record<string, SQLOutputValue>;
type Valori = Record<string, SQLInputValue>;

// Voce del catalogo degli incantesimi come la vede il client (GET /api/incantesimi).
export interface VoceIncantesimo {
  id: number;
  nome: string;
  livello: number;
  scuola: string;
  tempo: string;
  scheda?: DettagliIncantesimo;
}

const testo = (v: SQLOutputValue) => (v === null ? "" : String(v));
const facoltativo = (v: SQLOutputValue) => (v === null ? undefined : v);

// --- Conversione tra oggetti e colonne ---

function colonneIncantesimo(nome: string, livello: number, scuola: string, tempo: string, s?: DettagliIncantesimo): Valori {
  return {
    nome, livello, scuola, tempo,
    gittata: s?.gittata ?? null,
    componenti: s?.componenti ?? null,
    durata: s?.durata ?? null,
    concentrazione: s?.concentrazione ? 1 : 0,
    rituale: s?.rituale ? 1 : 0,
    descrizione: s?.descrizione ?? null,
    livello_superiore: s?.livelloSuperiore ?? null,
    attacco_numero: s?.attacco?.numero ?? null,
    attacco_per_livello: s?.attacco?.perLivello ?? null,
    ts_caratteristica: s?.tiroSalvezza?.car ?? null,
    ts_effetto: s?.tiroSalvezza?.effetto ?? null,
    danni_dado: s?.danni?.dado ?? null,
    danni_tipo: s?.danni?.tipo ?? null,
    danni_mod: s?.danni?.mod ?? null,
    danni_per_livello: s?.danni?.perLivello ?? null,
    danni_mod_per_livello: s?.danni?.modPerLivello ?? null,
    danni_trucchetto: s?.danni?.trucchetto ? 1 : null,
    danni_per_attacco: s?.danni?.perAttacco ? 1 : null,
  };
}

// I campi facoltativi compaiono solo se valorizzati, come nei seed.
export function voceIncantesimo(r: Riga): VoceIncantesimo {
  const voce: VoceIncantesimo = {
    id: Number(r.id), nome: testo(r.nome), livello: Number(r.livello), scuola: testo(r.scuola), tempo: testo(r.tempo),
  };
  if (r.descrizione === null) return voce; // voce senza dettagli: si può solo spendere lo slot
  const s: DettagliIncantesimo = {
    gittata: testo(r.gittata), componenti: testo(r.componenti), durata: testo(r.durata),
    concentrazione: r.concentrazione === 1, rituale: r.rituale === 1, descrizione: testo(r.descrizione),
  };
  if (r.livello_superiore !== null) s.livelloSuperiore = testo(r.livello_superiore);
  if (r.attacco_numero !== null) {
    s.attacco = { numero: Number(r.attacco_numero) };
    if (r.attacco_per_livello !== null) s.attacco.perLivello = Number(r.attacco_per_livello);
  }
  if (r.ts_caratteristica !== null) {
    s.tiroSalvezza = { car: testo(r.ts_caratteristica) as Caratteristica, effetto: testo(r.ts_effetto) };
  }
  if (r.danni_dado !== null) {
    s.danni = { dado: testo(r.danni_dado), tipo: testo(r.danni_tipo) };
    if (r.danni_mod !== null) s.danni.mod = Number(r.danni_mod);
    if (r.danni_per_livello !== null) s.danni.perLivello = testo(r.danni_per_livello);
    if (r.danni_mod_per_livello !== null) s.danni.modPerLivello = Number(r.danni_mod_per_livello);
    if (r.danni_trucchetto === 1) s.danni.trucchetto = true;
    if (r.danni_per_attacco === 1) s.danni.perAttacco = true;
  }
  voce.scheda = s;
  return voce;
}

const colonneArma = (a: Arma): Valori => ({
  nome: a.nome, dado: a.dado, dado_versatile: a.dadoVersatile ?? null,
  tipo_danno: a.tipoDanno, proprieta: a.proprieta, accurata: a.accurata ? 1 : 0,
});

export function armaDaRiga(r: Riga): Arma {
  const arma: Arma = {
    nome: testo(r.nome), dado: testo(r.dado), tipoDanno: testo(r.tipo_danno), proprieta: testo(r.proprieta),
    accurata: r.accurata === 1,
  };
  const versatile = facoltativo(r.dado_versatile);
  return versatile === undefined ? arma : { ...arma, dadoVersatile: String(versatile) };
}

const colonnePrivilegio = (p: Privilegio): Valori => ({ nome: p.nome, fonte: p.fonte, descrizione: p.descrizione });

export const privilegioDaRiga = (r: Riga): Privilegio => ({
  nome: testo(r.nome), fonte: testo(r.fonte), descrizione: testo(r.descrizione),
});

// --- Scrittura ---

function inserisci(db: DatabaseSync, tabella: string, valori: Valori, conflitto?: string): number {
  const colonne = Object.keys(valori);
  const aggiorna = conflitto
    ? ` ON CONFLICT(${conflitto}) DO UPDATE SET ${colonne.map(c => `${c} = excluded.${c}`).join(", ")} WHERE ${tabella}.creato_da IS NULL`
    : "";
  const esito = db.prepare(
    `INSERT INTO ${tabella} (${colonne.join(", ")}) VALUES (${colonne.map(c => `:${c}`).join(", ")})${aggiorna}`,
  ).run(valori);
  return Number(esito.lastInsertRowid);
}

// Porta nell'archivio le voci ufficiali dei seed. Le voci create dagli utenti non vengono toccate,
// neanche se hanno lo stesso nome di una voce ufficiale.
export function aggiornaCataloghi(db: DatabaseSync) {
  for (const [nome, s] of Object.entries(SCHEDE_INCANTESIMI)) {
    inserisci(db, "incantesimi", colonneIncantesimo(nome, s.livello, s.scuola, s.tempo, s), "nome");
  }
  for (const a of ARMI) inserisci(db, "armi", colonneArma(a), "nome");
  for (const p of PRIVILEGI) inserisci(db, "privilegi", colonnePrivilegio(p), "nome, fonte");
}

// Id della voce con quel nome; se non esiste la si crea come voce dell'utente.
// I campi di una voce esistente non cambiano: valgono quelli del catalogo.
export function idIncantesimo(
  db: DatabaseSync, s: { nome: string; livello: number; scuola: string; tempo: string; scheda?: DettagliIncantesimo },
  utenteId: number,
): number {
  const riga = db.prepare("SELECT id FROM incantesimi WHERE nome = ?").get(s.nome);
  if (riga) return Number(riga.id);
  return inserisci(db, "incantesimi", { ...colonneIncantesimo(s.nome, s.livello, s.scuola, s.tempo, s.scheda), creato_da: utenteId });
}

export function idArma(db: DatabaseSync, a: Arma, utenteId: number): number {
  const riga = db.prepare("SELECT id FROM armi WHERE nome = ?").get(a.nome);
  if (riga) return Number(riga.id);
  return inserisci(db, "armi", { ...colonneArma(a), creato_da: utenteId });
}

export function idPrivilegio(db: DatabaseSync, p: Privilegio, utenteId: number): number {
  const riga = db.prepare("SELECT id FROM privilegi WHERE nome = ? AND fonte = ?").get(p.nome, p.fonte);
  if (riga) return Number(riga.id);
  return inserisci(db, "privilegi", { ...colonnePrivilegio(p), creato_da: utenteId });
}

// --- Lettura ---

export const elencoIncantesimi = (db: DatabaseSync): VoceIncantesimo[] =>
  db.prepare("SELECT * FROM incantesimi ORDER BY livello, nome").all().map(voceIncantesimo);
