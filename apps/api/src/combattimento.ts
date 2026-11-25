import type { Combattimento, VoceIniziativa } from "@dnd/regole/api.ts";
import { CONDIZIONI } from "@dnd/regole/dati/condizioni.ts";
import { avanzaTurno, derivate, ordineIniziativa, statoSalute } from "@dnd/regole/regole.ts";
import { riga, righe, transazione, type Esecutore, type Riga } from "./db.ts";
import { ErroreRichiesta } from "./errori.ts";
import { componi } from "./personaggi.ts";

// Tracker d'iniziativa del party. Il Master avvia e termina lo scontro, aggiunge i mostri e fa avanzare
// i turni; ogni giocatore inserisce l'iniziativa del suo personaggio. Le voci nascoste le vede solo il Master.

export const LUNGHEZZA_NOME_VOCE = 60;

const numeroONull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const voceDaRiga = (r: Riga): VoceIniziativa => {
  const pf = numeroONull(r.pf);
  const pfMassimi = numeroONull(r.pf_massimi);
  return {
    id: Number(r.id), personaggioId: numeroONull(r.personaggio_id), nome: String(r.nome),
    valore: Number(r.valore), bonus: Number(r.bonus), nascosto: Boolean(r.nascosto),
    ca: numeroONull(r.ca), pf, pfMassimi, condizioni: (r.condizioni as string[] | null) ?? [], note: String(r.note ?? ""),
    stato: statoSalute(pf, pfMassimi),
  };
};

// Ai giocatori di un mostro arrivano solo nome, iniziativa e stato di salute.
const perGiocatori = (v: VoceIniziativa): VoceIniziativa => ({ ...v, ca: null, pf: null, pfMassimi: null, condizioni: [], note: "" });

// Un mostro a 0 PF è sconfitto: non prende più il turno.
const sconfitto = (v: VoceIniziativa) => v.stato === "sconfitto";

export async function leggiCombattimento(db: Esecutore, partyId: number, master: boolean): Promise<Combattimento> {
  const [c, voci] = await Promise.all([
    riga(db, "SELECT round, di_turno FROM party_combattimento WHERE party_id = $1", [partyId]),
    righe(db, "SELECT * FROM party_iniziativa WHERE party_id = $1", [partyId]),
  ]);
  if (!c) return { attivo: false, round: 0, diTurno: null, voci: [] };
  const ordine = ordineIniziativa(voci.map(voceDaRiga)).filter(v => master || !v.nascosto).map(v => (master ? v : perGiocatori(v)));
  const diTurno = c.di_turno === null ? null : Number(c.di_turno);
  return { attivo: true, round: Number(c.round), diTurno: ordine.some(v => v.id === diTurno) ? diTurno : null, voci: ordine };
}

const richiediAttivo = async (db: Esecutore, partyId: number) => {
  if (!(await riga(db, "SELECT 1 FROM party_combattimento WHERE party_id = $1", [partyId]))) {
    throw new ErroreRichiesta(409, "Nessun combattimento in corso");
  }
};

// Un nuovo scontro parte senza voci; se ce n'è già uno in corso non cambia nulla.
export async function avviaCombattimento(db: Esecutore, partyId: number) {
  await transazione(db, async t => {
    const r = await t.query("INSERT INTO party_combattimento (party_id) VALUES ($1) ON CONFLICT DO NOTHING", [partyId]);
    if ((r.rowCount ?? 0) > 0) await t.query("DELETE FROM party_iniziativa WHERE party_id = $1", [partyId]);
  });
}

export async function terminaCombattimento(db: Esecutore, partyId: number) {
  await transazione(db, async t => {
    await t.query("DELETE FROM party_combattimento WHERE party_id = $1", [partyId]);
    await t.query("DELETE FROM party_iniziativa WHERE party_id = $1", [partyId]);
  });
}

export async function avanza(db: Esecutore, partyId: number, direzione: 1 | -1) {
  await transazione(db, async t => {
    const c = await riga(t, "SELECT round, di_turno FROM party_combattimento WHERE party_id = $1 FOR UPDATE", [partyId]);
    if (!c) throw new ErroreRichiesta(409, "Nessun combattimento in corso");
    const voci = (await righe(t, "SELECT * FROM party_iniziativa WHERE party_id = $1", [partyId])).map(voceDaRiga);
    const prossimo = avanzaTurno(ordineIniziativa(voci), c.di_turno === null ? null : Number(c.di_turno), Number(c.round), direzione, sconfitto);
    await t.query("UPDATE party_combattimento SET round = $2, di_turno = $3 WHERE party_id = $1", [partyId, prossimo.round, prossimo.diTurno]);
  });
}

// L'iniziativa del personaggio del giocatore: il modificatore lo calcola il server dalla scheda.
export async function iniziativaPersonaggio(db: Esecutore, partyId: number, personaggioId: number, valore: number) {
  await richiediAttivo(db, partyId);
  const scheda = await componi(db, personaggioId);
  if (!scheda) throw new ErroreRichiesta(404, "Personaggio inesistente");
  await db.query(`
    INSERT INTO party_iniziativa (party_id, personaggio_id, nome, valore, bonus) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (party_id, personaggio_id) DO UPDATE SET nome = EXCLUDED.nome, valore = EXCLUDED.valore, bonus = EXCLUDED.bonus`,
  [partyId, personaggioId, scheda.info.nome || "Senza nome", valore, derivate(scheda).iniziativa]);
}

export interface DatiVoceIniziativa {
  nome?: string;
  valore?: number;
  bonus?: number;
  nascosto?: boolean;
  ca?: number | null;
  pf?: number | null;
  pfMassimi?: number | null;
  condizioni?: string[];
  note?: string;
}

const ID_CONDIZIONI = new Set(CONDIZIONI.map(c => c.id));
export const LUNGHEZZA_NOTE_VOCE = 2000;

// Campi di una voce dal corpo della richiesta; con `tutti` servono nome e valore.
export function datiIniziativaDa(corpo: Record<string, unknown>, tutti: boolean): DatiVoceIniziativa {
  const { nome, valore, bonus, nascosto } = corpo;
  const intero = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  const dati: DatiVoceIniziativa = {};
  if (nome !== undefined || tutti) {
    const n = typeof nome === "string" ? nome.trim() : "";
    if (n.length < 1 || n.length > LUNGHEZZA_NOME_VOCE) throw new ErroreRichiesta(400, `Il nome deve avere da 1 a ${LUNGHEZZA_NOME_VOCE} caratteri`);
    dati.nome = n;
  }
  if (valore !== undefined || tutti) {
    if (!intero(valore, -10, 100)) throw new ErroreRichiesta(400, "Iniziativa non valida");
    dati.valore = valore as number;
  }
  if (bonus !== undefined) {
    if (!intero(bonus, -20, 30)) throw new ErroreRichiesta(400, "Modificatore non valido");
    dati.bonus = bonus as number;
  }
  if (nascosto !== undefined) {
    if (typeof nascosto !== "boolean") throw new ErroreRichiesta(400, "Nascosto non valido");
    dati.nascosto = nascosto;
  }
  // CA e PF: null li toglie.
  const facoltativo = (chiave: "ca" | "pf" | "pfMassimi", min: number, max: number, nome: string) => {
    const v = corpo[chiave];
    if (v === undefined) return;
    if (v !== null && !intero(v, min, max)) throw new ErroreRichiesta(400, `${nome} non valida`);
    dati[chiave] = v as number | null;
  };
  facoltativo("ca", 0, 50, "CA");
  facoltativo("pf", 0, 100_000, "PF");
  facoltativo("pfMassimi", 1, 100_000, "PF massimi");
  if (corpo.condizioni !== undefined) {
    const c = corpo.condizioni;
    if (!Array.isArray(c) || !c.every(x => typeof x === "string" && ID_CONDIZIONI.has(x))) throw new ErroreRichiesta(400, "Condizioni non valide");
    dati.condizioni = [...new Set(c as string[])];
  }
  if (corpo.note !== undefined) {
    if (typeof corpo.note !== "string" || corpo.note.length > LUNGHEZZA_NOTE_VOCE) {
      throw new ErroreRichiesta(400, `Le note possono avere al massimo ${LUNGHEZZA_NOTE_VOCE} caratteri`);
    }
    dati.note = corpo.note;
  }
  return dati;
}

export async function aggiungiVoce(db: Esecutore, partyId: number, v: DatiVoceIniziativa): Promise<number> {
  await richiediAttivo(db, partyId);
  const pfMassimi = v.pfMassimi ?? null;
  const r = await riga(db, `
    INSERT INTO party_iniziativa (party_id, nome, valore, bonus, nascosto, ca, pf, pf_massimi, condizioni, note)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
  [partyId, v.nome, v.valore, v.bonus ?? 0, v.nascosto ?? false, v.ca ?? null, v.pf ?? pfMassimi, pfMassimi, v.condizioni ?? [], v.note ?? ""]);
  return Number(r!.id);
}

// Cambia solo i campi presenti. I PF restano tra 0 e i massimi; CA, PF e massimi si tolgono con null.
// I dati del mostro non valgono per le voci dei personaggi, che li prendono dalla scheda.
export async function modificaVoceIniziativa(db: Esecutore, partyId: number, id: number, v: DatiVoceIniziativa): Promise<boolean> {
  const campi: string[] = [];
  const valori: unknown[] = [partyId, id];
  const imposta = (colonna: string, valore: unknown) => {
    valori.push(valore);
    campi.push(`${colonna} = $${valori.length}`);
  };
  if (v.nome !== undefined) imposta("nome", v.nome);
  if (v.valore !== undefined) imposta("valore", v.valore);
  if (v.bonus !== undefined) imposta("bonus", v.bonus);
  if (v.nascosto !== undefined) imposta("nascosto", v.nascosto);
  if (v.ca !== undefined) imposta("ca", v.ca);
  if (v.pfMassimi !== undefined) imposta("pf_massimi", v.pfMassimi);
  if (v.pf !== undefined) imposta("pf", v.pf);
  if (v.condizioni !== undefined) imposta("condizioni", v.condizioni);
  if (v.note !== undefined) imposta("note", v.note);
  const mostro = v.ca !== undefined || v.pf !== undefined || v.pfMassimi !== undefined || v.condizioni !== undefined || v.note !== undefined;
  if (campi.length === 0) return Boolean(await riga(db, "SELECT 1 FROM party_iniziativa WHERE party_id = $1 AND id = $2", [partyId, id]));
  const r = await riga(db, `
    UPDATE party_iniziativa SET ${campi.join(", ")} WHERE party_id = $1 AND id = $2 ${mostro ? "AND personaggio_id IS NULL" : ""}
    RETURNING pf, pf_massimi`, valori);
  if (!r) {
    if (mostro && (await riga(db, "SELECT 1 FROM party_iniziativa WHERE party_id = $1 AND id = $2", [partyId, id]))) {
      throw new ErroreRichiesta(400, "CA, PF e condizioni dei personaggi vengono dalla loro scheda");
    }
    return false;
  }
  // PF oltre i massimi (o massimi abbassati sotto i PF attuali): si riportano ai massimi.
  if (r.pf !== null && r.pf_massimi !== null && Number(r.pf) > Number(r.pf_massimi)) {
    await db.query("UPDATE party_iniziativa SET pf = pf_massimi WHERE id = $1", [id]);
  }
  return true;
}

export async function togliVoce(db: Esecutore, partyId: number, id: number): Promise<boolean> {
  const r = await db.query("DELETE FROM party_iniziativa WHERE party_id = $1 AND id = $2", [partyId, id]);
  return (r.rowCount ?? 0) > 0;
}

// Stato dello scontro del party p per l'elenco: round e se è il turno del personaggio del membro m.
export const SQL_COMBATTIMENTO_ELENCO = `
  (SELECT json_build_object('round', c.round, 'tuoTurno', coalesce(vi.personaggio_id = m.personaggio_id, false))
   FROM party_combattimento c LEFT JOIN party_iniziativa vi ON vi.id = c.di_turno WHERE c.party_id = p.id)`;
