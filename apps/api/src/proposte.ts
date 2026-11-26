import type { PropostaParty, TipoProposta } from "@dnd/regole/api.ts";
import { inserisciRighe, riga, righe, type Esecutore, type Riga } from "./db.ts";
import { ErroreRichiesta } from "./errori.ts";
import { MASSIMO_INTERO } from "./parametri.ts";

// Proposte del Master ai personaggi del party: PE, riposo breve o lungo, un giorno che passa.
// Il server non modifica le schede: il giocatore accetta (la scheda applica la proposta, come per il tesoro
// "prima il server, poi la scheda") oppure rifiuta. In entrambi i casi la proposta si chiude.

export const TIPI_PROPOSTA: readonly TipoProposta[] = ["pe", "riposo_breve", "riposo_lungo", "giorno"];
export const LUNGHEZZA_MOTIVO = 200;
const MASSIMO_PE = 1_000_000;

export interface DatiProposta {
  tipo: TipoProposta;
  personaggi: number[];
  pe: number | null; // PE totali, divisi in parti uguali (per difetto)
  motivo: string;
}

export function datiPropostaDa(corpo: Record<string, unknown>): DatiProposta {
  const { tipo, personaggi, pe, motivo } = corpo;
  if (typeof tipo !== "string" || !TIPI_PROPOSTA.includes(tipo as TipoProposta)) throw new ErroreRichiesta(400, "Tipo di proposta non valido");
  if (!Array.isArray(personaggi) || personaggi.length < 1 || personaggi.length > 50
    || !personaggi.every(p => Number.isInteger(p) && p >= 1 && p <= MASSIMO_INTERO)) {
    throw new ErroreRichiesta(400, "Scegli almeno un personaggio");
  }
  if (motivo !== undefined && (typeof motivo !== "string" || motivo.length > LUNGHEZZA_MOTIVO)) {
    throw new ErroreRichiesta(400, `Il motivo può avere al massimo ${LUNGHEZZA_MOTIVO} caratteri`);
  }
  if (tipo === "pe" && !(Number.isInteger(pe) && (pe as number) >= 1 && (pe as number) <= MASSIMO_PE)) {
    throw new ErroreRichiesta(400, `PE: un numero intero da 1 a ${MASSIMO_PE.toLocaleString("it-IT")}`);
  }
  return {
    tipo: tipo as TipoProposta, personaggi: [...new Set(personaggi as number[])],
    pe: tipo === "pe" ? (pe as number) : null, motivo: typeof motivo === "string" ? motivo.trim() : "",
  };
}

const propostaDaRiga = (r: Riga): PropostaParty => ({
  id: Number(r.id), personaggioId: Number(r.personaggio_id), personaggio: String(r.personaggio ?? ""),
  tipo: r.tipo as TipoProposta, pe: r.pe === null ? null : Number(r.pe), motivo: String(r.motivo),
  creato: new Date(r.creato as string).toISOString(),
});

const SQL_PROPOSTE = `
  SELECT pp.id, pp.personaggio_id, pe.nome AS personaggio, pp.tipo, pp.pe, pp.motivo, pp.creato
  FROM party_proposte pp JOIN personaggi pe ON pe.id = pp.personaggio_id`;

// Proposte per `elencoParty`: SQL da usare come sottoquery con m = la riga di party_membri dell'utente.
export const SQL_PROPOSTE_ELENCO = `
  (SELECT coalesce(json_agg(json_build_object(
      'id', pp.id, 'personaggioId', pp.personaggio_id, 'personaggio', pe.nome, 'tipo', pp.tipo, 'pe', pp.pe,
      'motivo', pp.motivo, 'creato', pp.creato) ORDER BY pp.id), '[]'::json)
    FROM party_proposte pp JOIN personaggi pe ON pe.id = pp.personaggio_id WHERE pp.personaggio_id = m.personaggio_id)`;

// Le proposte in sospeso del party (tutte, per il Master) o di un solo personaggio.
export const proposteDel = async (db: Esecutore, partyId: number, personaggioId: number | null): Promise<PropostaParty[]> =>
  (await righe(db, `${SQL_PROPOSTE} WHERE pp.party_id = $1 AND ($2::int IS NULL OR pp.personaggio_id = $2) ORDER BY pp.id`,
    [partyId, personaggioId])).map(propostaDaRiga);

// Una proposta per ogni personaggio scelto, che deve essere del party. Con i PE restituisce la quota a testa.
export async function creaProposte(db: Esecutore, partyId: number, dati: DatiProposta): Promise<{ quota: number | null }> {
  const presenti = await righe(db, "SELECT personaggio_id FROM party_membri WHERE party_id = $1 AND personaggio_id = ANY($2::int[])",
    [partyId, dati.personaggi]);
  if (presenti.length !== dati.personaggi.length) throw new ErroreRichiesta(400, "Uno dei personaggi non è nel party");
  const quota = dati.pe === null ? null : Math.floor(dati.pe / dati.personaggi.length);
  if (quota !== null && quota < 1) throw new ErroreRichiesta(400, "Troppo pochi PE: ogni personaggio deve riceverne almeno 1");
  await inserisciRighe(db, "party_proposte", ["party_id", "personaggio_id", "tipo", "pe", "motivo"],
    dati.personaggi.map(p => [partyId, p, dati.tipo, quota, dati.motivo]));
  return { quota };
}

// Chiude una proposta (accettata o rifiutata) e la restituisce. Con `personaggioId` solo se è sua
// (il giocatore); con null qualunque proposta del party (il Master la ritira). null se non c'è più.
export async function chiudiProposta(
  db: Esecutore, partyId: number, id: number, personaggioId: number | null,
): Promise<PropostaParty | null> {
  const r = await riga(db, `
    WITH chiusa AS (
      DELETE FROM party_proposte WHERE id = $2 AND party_id = $1 AND ($3::int IS NULL OR personaggio_id = $3) RETURNING *
    )
    SELECT c.id, c.personaggio_id, pe.nome AS personaggio, c.tipo, c.pe, c.motivo, c.creato
    FROM chiusa c JOIN personaggi pe ON pe.id = c.personaggio_id`, [partyId, id, personaggioId]);
  return r ? propostaDaRiga(r) : null;
}
