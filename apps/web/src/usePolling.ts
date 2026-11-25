import { useEffect, useRef } from "react";

// Esegue `controlla` subito e poi ogni `intervallo` ms, solo con la pagina visibile; ricontrolla
// quando la pagina torna visibile, al focus e al ritorno della rete. Un controllo ancora in corso
// non viene sovrapposto. Con `attivo` false non fa nulla.
export function usePolling(controlla: () => Promise<void>, intervallo: number, attivo = true) {
  const funzione = useRef(controlla);
  useEffect(() => {
    funzione.current = controlla;
  }, [controlla]);

  useEffect(() => {
    if (!attivo) return;
    let inCorso = false;
    const esegui = () => {
      if (document.visibilityState !== "visible" || inCorso) return;
      inCorso = true;
      funzione.current()
        .catch(errore => console.error("Aggiornamento non riuscito", errore))
        .finally(() => { inCorso = false; });
    };
    esegui();
    const timer = setInterval(esegui, intervallo);
    window.addEventListener("focus", esegui);
    window.addEventListener("online", esegui);
    document.addEventListener("visibilitychange", esegui);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", esegui);
      window.removeEventListener("online", esegui);
      document.removeEventListener("visibilitychange", esegui);
    };
  }, [intervallo, attivo]);
}
