import { useCallback, useRef, useState } from "react";
import type { MessaggioParty } from "@dnd/regole/api.ts";
import { inviaMessaggio, leggiMessaggi, segnaLetto, type ControllaEsito } from "./party";
import { usePolling } from "./usePolling";

// Chat del party: messaggi di gruppo e privati. Con la schermata del party aperta si chiedono
// i messaggi nuovi ogni pochi secondi; le letture si tengono per conversazione.

const AGGIORNAMENTO = 4_000; // ms
const PER_PAGINA = 100; // come MESSAGGI_PER_PAGINA dell'API

// Conversazione di un messaggio dal punto di vista di `io`: 0 = gruppo, altrimenti l'altro utente del privato.
export const conversazioneDi = (m: MessaggioParty, io: number) =>
  m.destinatarioId === null ? 0 : m.autoreId === io ? m.destinatarioId : m.autoreId;

// Messaggi degli altri non ancora letti, per conversazione.
export function nonLettiPer(messaggi: MessaggioParty[], letture: Record<number, number>, io: number): Record<number, number> {
  const conti: Record<number, number> = {};
  for (const m of messaggi) {
    const con = conversazioneDi(m, io);
    if (m.autoreId !== io && m.id > (letture[con] ?? 0)) conti[con] = (conti[con] ?? 0) + 1;
  }
  return conti;
}

const unisci = (a: MessaggioParty[], b: MessaggioParty[]) => {
  const visti = new Set(a.map(m => m.id));
  return [...a, ...b.filter(m => !visti.has(m.id))].sort((x, y) => x.id - y.id);
};

export function useMessaggi(partyId: number, riuscito: ControllaEsito) {
  const [messaggi, setMessaggi] = useState<MessaggioParty[] | null>(null);
  const [letture, setLetture] = useState<Record<number, number>>({});
  const [finiti, setFiniti] = useState(false); // non ci sono messaggi più vecchi da caricare
  const ultimo = useRef<number | null>(null);
  const segnate = useRef<Record<number, number>>({});

  const aggiorna = useCallback(async () => {
    const dopo = ultimo.current;
    const esito = await leggiMessaggi(partyId, dopo === null ? {} : { dopo });
    if (!riuscito(esito)) return;
    const nuovi = esito.dati.messaggi;
    if (dopo === null) setFiniti(nuovi.length < PER_PAGINA);
    if (nuovi.length > 0) ultimo.current = Math.max(ultimo.current ?? 0, nuovi[nuovi.length - 1].id);
    setMessaggi(prec => unisci(prec ?? [], nuovi));
    setLetture(prec => {
      const tutte = { ...prec };
      for (const [con, fino] of Object.entries(esito.dati.letture)) tutte[Number(con)] = Math.max(tutte[Number(con)] ?? 0, fino);
      return tutte;
    });
  }, [partyId, riuscito]);

  usePolling(aggiorna, AGGIORNAMENTO);

  const precedenti = useCallback(async () => {
    const primo = messaggi?.[0]?.id;
    if (primo === undefined) return;
    const esito = await leggiMessaggi(partyId, { prima: primo });
    if (!riuscito(esito)) return;
    setFiniti(esito.dati.messaggi.length < PER_PAGINA);
    setMessaggi(prec => unisci(esito.dati.messaggi, prec ?? []));
  }, [messaggi, partyId, riuscito]);

  // true se il messaggio è stato inviato.
  const invia = useCallback(async (testo: string, destinatarioId: number | null) => {
    const esito = await inviaMessaggio(partyId, testo, destinatarioId);
    if (!riuscito(esito)) return false;
    await aggiorna();
    return true;
  }, [partyId, riuscito, aggiorna]);

  const segna = useCallback(async (con: number, fino: number) => {
    if ((letture[con] ?? 0) >= fino || (segnate.current[con] ?? 0) >= fino) return;
    segnate.current[con] = fino;
    const esito = await segnaLetto(partyId, con, fino);
    if (riuscito(esito)) setLetture(prec => ({ ...prec, [con]: Math.max(prec[con] ?? 0, fino) }));
  }, [letture, partyId, riuscito]);

  return { messaggi, letture, finiti, aggiorna, precedenti, invia, segna };
}

export type Chat = ReturnType<typeof useMessaggi>;
