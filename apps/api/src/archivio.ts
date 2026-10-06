import type { CharacterData } from "@dnd/regole/tipi.ts";
import { riga, transazione, type Esecutore } from "./db.ts";
import { componiDiUtente, scomponi } from "./personaggi.ts";

// Accesso alle schede con concorrenza ottimistica. Ogni personaggio ha una revisione che cresce
// a ogni scrittura: due dispositivi non si sovrascrivono a vicenda senza accorgersene.

export interface Versione {
  dati: CharacterData;
  revisione: number;
}

export type EsitoScrittura =
  | { ok: true; revisione: number }
  | { ok: false; attuale: Versione }
  | { ok: false; attuale: null }; // personaggio inesistente o di un altro utente

// null se il personaggio non esiste o non è dell'utente.
export const leggi = (db: Esecutore, id: number, utenteId: number): Promise<Versione | null> => componiDiUtente(db, id, utenteId);

// Scrive solo se la revisione attesa coincide con quella salvata, altrimenti restituisce la versione
// attuale, così il client può scegliere quale tenere. L'UPDATE condizionato blocca la riga: una
// scrittura concorrente aspetta la fine di questa e poi trova la revisione già cambiata.
export async function scrivi(
  db: Esecutore, id: number, utenteId: number, dati: CharacterData, revisioneAttesa: number,
): Promise<EsitoScrittura> {
  return transazione(db, async t => {
    const aggiornata = await riga(t, `
      UPDATE personaggi SET revisione = revisione + 1, aggiornato = now()
      WHERE id = $1 AND utente_id = $2 AND revisione = $3 RETURNING revisione
    `, [id, utenteId, revisioneAttesa]);
    if (!aggiornata) {
      const attuale = await leggi(t, id, utenteId);
      return attuale ? { ok: false, attuale } : { ok: false, attuale: null };
    }
    await scomponi(t, id, dati, utenteId);
    return { ok: true, revisione: Number(aggiornata.revisione) };
  });
}
