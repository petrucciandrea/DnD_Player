import type { RiassuntoParty } from "@dnd/regole/api.ts";
import { testoProposta } from "./party";

// Notifiche del browser per il party ("Tocca a te!", messaggi nuovi, proposte del Master), solo con la pagina
// in secondo piano. Arrivano dal controllo di GET /party (polling): con la pagina nascosta il browser
// lo rallenta, quindi possono arrivare con un minuto di ritardo. La scelta si ricorda su questo dispositivo.

const CHIAVE = "dnd_notifiche_party";

export const notificheSupportate = () => typeof window !== "undefined" && "Notification" in window;

function scelta(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === "si";
  } catch {
    return false;
  }
}

function salvaScelta(attive: boolean) {
  try {
    localStorage.setItem(CHIAVE, attive ? "si" : "no");
  } catch {
    // Storage non disponibile: la scelta vale solo finché la pagina resta aperta.
  }
}

export const notificheAttive = () => notificheSupportate() && Notification.permission === "granted" && scelta();

// Va chiamata da un clic: il browser chiede il permesso solo dopo un gesto dell'utente.
export async function attivaNotifiche(): Promise<"attive" | "negate" | "non supportate"> {
  if (!notificheSupportate()) return "non supportate";
  const permesso = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permesso !== "granted") return "negate";
  salvaScelta(true);
  return "attive";
}

export const disattivaNotifiche = () => salvaScelta(false);

export interface Novita {
  titolo: string;
  corpo: string;
  tag: string; // una notifica con lo stesso tag sostituisce la precedente
}

// Cosa è cambiato tra due controlli dell'elenco dei party. Un party nuovo nell'elenco non notifica nulla.
export function novitaParty(prima: RiassuntoParty[], dopo: RiassuntoParty[]): Novita[] {
  const novita: Novita[] = [];
  for (const p of dopo) {
    const q = prima.find(x => x.id === p.id);
    if (!q) continue;
    if (p.combattimento?.tuoTurno && !q.combattimento?.tuoTurno) {
      novita.push({ titolo: "Tocca a te!", corpo: `${p.nome}: round ${p.combattimento.round}`, tag: `party-${p.id}-turno` });
    }
    if (p.nonLetti > q.nonLetti) {
      novita.push({
        titolo: p.nome, corpo: p.nonLetti === 1 ? "Un messaggio nuovo" : `${p.nonLetti} messaggi non letti`, tag: `party-${p.id}-chat`,
      });
    }
    // `?? []`: un server non ancora aggiornato (durante il deploy) non manda le proposte.
    const viste = new Set((q.proposte ?? []).map(x => x.id));
    for (const x of (p.proposte ?? []).filter(x => !viste.has(x.id))) {
      novita.push({ titolo: p.nome, corpo: `Il Master propone ${testoProposta(x)}`, tag: `party-${p.id}-proposta-${x.id}` });
    }
  }
  return novita;
}

export function notifica({ titolo, corpo, tag }: Novita) {
  if (!notificheAttive() || document.visibilityState === "visible") return;
  try {
    const n = new Notification(titolo, { body: corpo, tag, icon: "/favicon.svg" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Alcuni browser (Chrome su Android) mostrano notifiche solo da un service worker: lì non arrivano.
  }
}
