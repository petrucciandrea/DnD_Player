import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import type { SetChar } from "./stato.ts";
import {
  caricaRiferimento, inviaAlServer, salva, salvaRiferimento, scaricaDalServer, type VersioneServer,
} from "./salvataggio";

export type StatoSincronizzazione = "connessione" | "sincronizzato" | "in invio" | "offline";

const ATTESA_INVIO = 500; // ms dall'ultima modifica prima di inviarla
const INTERVALLO_CONTROLLO = 15_000; // ms tra due controlli degli aggiornamenti, con la pagina visibile

const MESSAGGIO_CONFLITTO =
  "La scheda è stata modificata da un altro dispositivo.\n\n" +
  "OK: carica quella versione (le modifiche fatte qui vanno perse).\n" +
  "Annulla: sovrascrivila con la scheda di questo dispositivo.";

// Tiene la scheda allineata con l'archivio SQLite del server locale (server/api.ts).
// Ogni modifica finisce subito nel localStorage, che fa da copia offline, e poco dopo sul server.
// Gli aggiornamenti fatti da altri dispositivi si caricano all'avvio, al ritorno sulla pagina
// e ogni INTERVALLO_CONTROLLO. Le scritture usano la revisione del server per accorgersi dei conflitti.
// Se il server risponde che la sessione è scaduta si chiama `onSessioneScaduta`: le modifiche non
// inviate restano nel localStorage e partono al prossimo accesso. Se il personaggio non esiste più
// (o non è dell'utente collegato) si chiama `onInesistente`.
export interface AvvisiSincronizzazione {
  onSessioneScaduta: () => void;
  onInesistente: () => void;
}

export function useSincronizzazione(personaggio: number, char: CharacterData, setChar: SetChar, avvisi: AvvisiSincronizzazione) {
  const [stato, setStato] = useState<StatoSincronizzazione>("connessione");
  const [riferimentoIniziale] = useState(() => caricaRiferimento(personaggio));
  const riferimento = useRef(riferimentoIniziale);
  const ultima = useRef(char); // la scheda più recente, letta dalle operazioni asincrone
  const allineata = useRef(char); // scheda che non va inviata: quella iniziale o quella appena scaricata
  const coda = useRef(Promise.resolve()); // invii e controlli si eseguono uno alla volta
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const avvisiAttuali = useRef(avvisi);

  useEffect(() => {
    avvisiAttuali.current = avvisi;
  }, [avvisi]);

  const aggiorna = useCallback((revisione: number, inSospeso: boolean) => {
    riferimento.current = { revisione, inSospeso };
    salvaRiferimento(personaggio, riferimento.current);
  }, [personaggio]);

  const accoda = useCallback((operazione: () => Promise<void>) => {
    coda.current = coda.current.then(operazione).catch(e => console.error("Sincronizzazione non riuscita", e));
  }, []);

  const applica = useCallback((v: VersioneServer) => {
    clearTimeout(timer.current);
    allineata.current = v.dati;
    ultima.current = v.dati;
    aggiorna(v.revisione, false);
    setChar(v.dati);
    setStato("sincronizzato");
  }, [aggiorna, setChar]);

  const invia = useCallback(async () => {
    for (;;) {
      const dati = ultima.current;
      const esito = await inviaAlServer(personaggio, dati, riferimento.current.revisione);
      if (esito.tipo === "offline") return setStato("offline");
      if (esito.tipo === "sessione scaduta") return avvisiAttuali.current.onSessioneScaduta();
      if (esito.tipo === "inesistente") return avvisiAttuali.current.onInesistente();
      if (esito.tipo === "ok") {
        // Se nel frattempo ci sono state altre modifiche, restano in sospeso per il prossimo invio.
        const tutteInviate = ultima.current === dati;
        aggiorna(esito.revisione, !tutteInviate);
        if (tutteInviate) setStato("sincronizzato");
        return;
      }
      // Versione del server illeggibile: si riprova più tardi invece di sovrascriverla alla cieca.
      if (!esito.attuale) return setStato("offline");
      if (confirm(MESSAGGIO_CONFLITTO)) return applica(esito.attuale);
      // Si tiene la scheda locale: la si riscrive sopra la versione attuale del server.
      aggiorna(esito.attuale.revisione, true);
    }
  }, [personaggio, aggiorna, applica]);

  const controlla = useCallback(async () => {
    if (riferimento.current.inSospeso) return invia();
    const esito = await scaricaDalServer(personaggio);
    if (esito.tipo === "offline") return setStato("offline");
    if (esito.tipo === "sessione scaduta") return avvisiAttuali.current.onSessioneScaduta();
    if (esito.tipo === "inesistente") return avvisiAttuali.current.onInesistente();
    if (riferimento.current.inSospeso) return invia(); // modifiche arrivate durante il download
    if (esito.versione.revisione !== riferimento.current.revisione) return applica(esito.versione);
    setStato("sincronizzato");
  }, [personaggio, applica, invia]);

  useEffect(() => {
    ultima.current = char;
    salva(personaggio, char);
    if (char === allineata.current) return;
    aggiorna(riferimento.current.revisione, true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStato("in invio");
      accoda(invia);
    }, ATTESA_INVIO);
  }, [personaggio, char, aggiorna, accoda, invia]);

  useEffect(() => {
    const seVisibile = () => {
      if (document.visibilityState === "visible") accoda(controlla);
    };
    // Lasciando la pagina si invia subito ciò che è in attesa, senza aspettare la pausa.
    const alCambioVisibilita = () => {
      if (document.visibilityState === "visible") return accoda(controlla);
      if (riferimento.current.inSospeso) {
        clearTimeout(timer.current);
        accoda(invia);
      }
    };
    seVisibile();
    const intervallo = setInterval(seVisibile, INTERVALLO_CONTROLLO);
    window.addEventListener("focus", seVisibile);
    window.addEventListener("online", seVisibile);
    document.addEventListener("visibilitychange", alCambioVisibilita);
    return () => {
      clearInterval(intervallo);
      window.removeEventListener("focus", seVisibile);
      window.removeEventListener("online", seVisibile);
      document.removeEventListener("visibilitychange", alCambioVisibilita);
    };
  }, [accoda, controlla, invia]);

  return stato;
}
