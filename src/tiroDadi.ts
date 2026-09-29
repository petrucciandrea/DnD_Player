import { useCallback, useRef, useState } from "react";
import type { Danni, Modalita } from "./regole";
import { risultatoD20, testoDanni, totaleDanni } from "./regole";
import type { CharacterData } from "./tipi";
import { suggerimentoTiro, type ContestoTiro } from "./dati/condizioni";

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
}

export interface RispostaTiro {
  tiri: number[];
  modalita: Modalita;
}

export interface TiroD20 {
  risultato: number; // il d20 che conta, dopo vantaggio o svantaggio
  tiri: number[];
  modalita: Modalita;
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
  return { ...richiesta, modalita, descrizione: descrizione || undefined };
}

export interface TiroDanni {
  tiri: number[];
  totale: number;
}

export async function tiraDanni(chiediTiro: ChiediTiro, titolo: string, danni: Danni): Promise<TiroDanni | null> {
  const tiri = await chiediTiro({
    titolo,
    descrizione: `${testoDanni(danni)} danni ${danni.tipo}`,
    dadi: Array.from({ length: danni.numero }, (_, i) => ({
      etichetta: danni.numero === 1 ? "Risultato" : `${i + 1}° dado`,
      facce: danni.facce,
    })),
    bonus: danni.mod,
    ammettiTotale: true,
  });
  return tiri && { tiri, totale: totaleDanni(tiri, danni.mod) };
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
    return { ...risposta, risultato: risultatoD20(risposta.tiri, risposta.modalita) };
  }, [chiedi]);

  const rispondi = useCallback((risposta: RispostaTiro | null) => {
    risolvi.current?.(risposta);
    risolvi.current = null;
    setRichiesta(null);
  }, []);

  return { richiesta, chiediTiro, chiediD20, rispondi };
}
