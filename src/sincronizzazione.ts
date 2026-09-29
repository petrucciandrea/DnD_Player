import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterData, SetChar } from "./tipi";
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
// inviate restano nel localStorage e partono al prossimo accesso.
export function useSincronizzazione(
  personaggio: string, char: CharacterData, setChar: SetChar, onSessioneScaduta: () => void,
) {
  const [stato, setStato] = useState<StatoSincronizzazione>("connessione");
  const [riferimentoIniziale] = useState(() => caricaRiferimento(personaggio));
  const riferimento = useRef(riferimentoIniziale);
  const ultima = useRef(char); // la scheda più recente, letta dalle operazioni asincrone
  const allineata = useRef(char); // scheda che non va inviata: quella iniziale o quella appena scaricata
  const coda = useRef(Promise.resolve()); // invii e controlli si eseguono uno alla volta
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sessioneScaduta = useRef(onSessioneScaduta);

  useEffect(() => {
    sessioneScaduta.current = onSessioneScaduta;
  }, [onSessioneScaduta]);

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
      const esito = await inviaAlServer(dati, riferimento.current.revisione);
      if (esito.tipo === "offline") return setStato("offline");
      if (esito.tipo === "sessione scaduta") return sessioneScaduta.current();
      if (esito.tipo === "ok") {
        // Se nel frattempo ci sono state altre modifiche, restano in sospeso per il prossimo invio.
        const tutteInviate = ultima.current === dati;
        aggiorna(esito.revisione, !tutteInviate);
        if (tutteInviate) setStato("sincronizzato");
        return;
      }
      if (esito.attuale && confirm(MESSAGGIO_CONFLITTO)) return applica(esito.attuale);
      // Si tiene la scheda locale: la si riscrive sopra la versione attuale del server.
      aggiorna(esito.attuale?.revisione ?? 0, true);
    }
  }, [aggiorna, applica]);

  const controlla = useCallback(async () => {
    if (riferimento.current.inSospeso) return invia();
    const esito = await scaricaDalServer();
    if (esito.tipo === "offline") return setStato("offline");
    if (esito.tipo === "sessione scaduta") return sessioneScaduta.current();
    if (esito.tipo === "vuoto") {
      // Archivio vuoto: ci si copia la scheda di questo browser (anche quella salvata prima del server).
      aggiorna(0, true);
      return invia();
    }
    if (riferimento.current.inSospeso) return invia(); // modifiche arrivate durante il download
    if (esito.versione.revisione !== riferimento.current.revisione) return applica(esito.versione);
    setStato("sincronizzato");
  }, [aggiorna, applica, invia]);

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
