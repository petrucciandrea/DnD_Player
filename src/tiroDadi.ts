import { useCallback, useRef, useState } from "react";

export interface Dado {
  etichetta: string;
  facce: number;
}

export interface RichiestaTiro {
  titolo: string;
  descrizione?: string;
  dadi: Dado[];
  bonus?: number; // aggiunto al totale dopo il tiro, solo informativo nel dialogo
}

// Risultati dei dadi nello stesso ordine di `dadi`, oppure null se l'utente annulla.
export type ChiediTiro = (richiesta: RichiestaTiro) => Promise<number[] | null>;

// Ogni tiro passa di qui: il dialogo chiede se tirare con dadi fisici
// (inserendo i risultati) o lasciar tirare l'app.
export function useRichiestaTiro() {
  const [richiesta, setRichiesta] = useState<(RichiestaTiro & { id: number }) | null>(null);
  const risolvi = useRef<((risultati: number[] | null) => void) | null>(null);
  const contatore = useRef(0);

  const chiediTiro = useCallback<ChiediTiro>(r => new Promise(resolve => {
    risolvi.current?.(null); // una richiesta ancora aperta viene annullata
    risolvi.current = resolve;
    contatore.current += 1;
    setRichiesta({ ...r, id: contatore.current });
  }), []);

  const rispondi = useCallback((risultati: number[] | null) => {
    risolvi.current?.(risultati);
    risolvi.current = null;
    setRichiesta(null);
  }, []);

  return { richiesta, chiediTiro, rispondi };
}
