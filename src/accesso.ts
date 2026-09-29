// Accesso all'archivio del server locale (server/api.ts). La sessione è un cookie HttpOnly:
// la pagina non vede il token, sa solo chi ha fatto l'accesso.

export interface Utente {
  username: string;
  personaggio: string; // id della scheda nell'archivio, usato anche per la copia nel localStorage
}

const utenteDa = (v: unknown): Utente | null =>
  typeof v === "object" && v !== null && "username" in v && "personaggio" in v
  && typeof v.username === "string" && typeof v.personaggio === "string"
    ? { username: v.username, personaggio: v.personaggio }
    : null;

// null se non c'è una sessione valida, "offline" se il server non risponde.
export async function sessioneAttuale(): Promise<Utente | null | "offline"> {
  try {
    const res = await fetch("/api/sessione", { cache: "no-store" });
    if (res.status === 401) return null;
    return res.ok ? utenteDa(await res.json()) ?? "offline" : "offline";
  } catch {
    return "offline";
  }
}

export async function accedi(username: string, password: string): Promise<{ utente: Utente } | { errore: string }> {
  try {
    const res = await fetch("/api/accesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const corpo: unknown = await res.json().catch(() => null);
    const utente = res.ok ? utenteDa(corpo) : null;
    if (utente) return { utente };
    if (res.status === 401) return { errore: "Username o password non corretti." };
    return { errore: "Accesso non riuscito: riprova." };
  } catch {
    return { errore: "Archivio non raggiungibile: controlla che il server sia avviato." };
  }
}

export async function esci() {
  try {
    await fetch("/api/uscita", { method: "POST" });
  } catch {
    // Se il server non risponde la sessione scadrà da sola: si torna comunque alla schermata di accesso.
  }
}
