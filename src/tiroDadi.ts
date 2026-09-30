import { useCallback, useRef, useState } from "react";
import type { Danni, Modalita } from "./regole";
import { descrizioneDanni, risultatoD20, testoDanni, totaleDanni } from "./regole";
import type { CharacterData } from "./tipi";
import { suggerimentoTiro, type ContestoTiro, type TipoTiro } from "./dati/condizioni";

export interface Dado {
  etichetta: string;
  facce: number;
}

export interface RichiestaTiro {
  titolo: string;
  descrizione?: string;
  dadi: Dado[];
  bonus?: number; // aggiunto al totale dopo il tiro, solo informativo nel dialogo
  d20?: boolean; // mostra la scelta normale / vantaggio / svantaggio
  modalita?: Modalita; // modalità preselezionata per i tiri d20
  ammettiTotale?: boolean; // si può inserire solo la somma: la risposta è allora [totale]
  tipo?: TipoTiro; // tiro per colpire, TS o prova: il Presagio può sostituirlo
}

export interface RispostaTiro {
  tiri: number[];
  modalita: Modalita;
  presagio?: number; // indice del dado del Presagio che ha sostituito il tiro
}

export interface TiroD20 {
  risultato: number; // il d20 che conta, dopo vantaggio o svantaggio
  tiri: number[];
  modalita: Modalita;
  presagio?: boolean; // il d20 è un dado del Presagio
}

// Risultati dei dadi nello stesso ordine di `dadi`, oppure null se l'utente annulla.
export type ChiediTiro = (richiesta: RichiestaTiro) => Promise<number[] | null>;
export type ChiediD20 = (richiesta: Omit<RichiestaTiro, "dadi" | "d20">) => Promise<TiroD20 | null>;

// Aggiunge alla richiesta di un d20 vantaggio o svantaggio e note che vengono da condizioni ed effetti attivi.
export function conSuggerimento(
  char: CharacterData, contesto: ContestoTiro, richiesta: Omit<RichiestaTiro, "dadi" | "d20">,
): Omit<RichiestaTiro, "dadi" | "d20"> {
  const { modalita, note } = suggerimentoTiro(char, contesto);
  const descrizione = [richiesta.descrizione, ...note].filter(Boolean).join(" ");
  return { ...richiesta, modalita, tipo: contesto.tipo, descrizione: descrizione || undefined };
}

export interface TiroDanni {
  tiri: number[];
  totale: number;
}

// Un solo dialogo per tutte le parti del danno (arma, Attacco Furtivo...). Senza dadi (danno fisso) il dialogo non si apre.
export async function tiraDanni(chiediTiro: ChiediTiro, titolo: string, danni: Danni | Danni[]): Promise<TiroDanni | null> {
  const parti = Array.isArray(danni) ? danni : [danni];
  const mod = parti.reduce((acc, p) => acc + p.mod, 0);
  const totDadi = parti.reduce((acc, p) => acc + p.numero, 0);
  if (totDadi === 0) return { tiri: [], totale: totaleDanni([], mod) };
  let n = 0;
  const dadi = parti.flatMap(p => Array.from({ length: p.numero }, () => {
    n += 1;
    return {
      etichetta: totDadi === 1 ? "Risultato" : `${n}° dado${p.etichetta ? ` (${p.etichetta})` : ""}`,
      facce: p.facce,
    };
  }));
  const tiri = await chiediTiro({
    titolo,
    descrizione: parti.length === 1 ? `${testoDanni(parti[0])} danni ${parti[0].tipo}` : descrizioneDanni(parti),
    dadi,
    bonus: mod,
    ammettiTotale: true,
  });
  return tiri && { tiri, totale: totaleDanni(tiri, mod) };
}

// Ogni tiro passa di qui: il dialogo chiede se tirare con dadi fisici
// (inserendo i risultati) o lasciar tirare l'app.
export function useRichiestaTiro() {
  const [richiesta, setRichiesta] = useState<(RichiestaTiro & { id: number }) | null>(null);
  const risolvi = useRef<((risposta: RispostaTiro | null) => void) | null>(null);
  const contatore = useRef(0);

  const chiedi = useCallback((r: RichiestaTiro) => new Promise<RispostaTiro | null>(resolve => {
    risolvi.current?.(null); // una richiesta ancora aperta viene annullata
    risolvi.current = resolve;
    contatore.current += 1;
    setRichiesta({ ...r, id: contatore.current });
  }), []);

  const chiediTiro = useCallback<ChiediTiro>(
    async r => (await chiedi(r))?.tiri ?? null,
    [chiedi],
  );

  const chiediD20 = useCallback<ChiediD20>(async r => {
    const risposta = await chiedi({ ...r, dadi: [{ etichetta: "Risultato", facce: 20 }], d20: true });
    if (!risposta) return null;
    const { presagio, ...resto } = risposta;
    return { ...resto, risultato: risultatoD20(risposta.tiri, risposta.modalita), ...(presagio !== undefined ? { presagio: true } : {}) };
  }, [chiedi]);

  const rispondi = useCallback((risposta: RispostaTiro | null) => {
    risolvi.current?.(risposta);
    risolvi.current = null;
    setRichiesta(null);
  }, []);

  return { richiesta, chiediTiro, chiediD20, rispondi };
}
