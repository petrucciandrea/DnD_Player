import type { FastifyReply, FastifyRequest } from "fastify";
import { DURATA_SESSIONE, leggiSessione } from "./accesso.ts";
import { ErroreRichiesta } from "./errori.ts";

// Sessione nel cookie `dnd_sessione`. HttpOnly: il token non è leggibile dal JavaScript della pagina.
// SameSite=Strict: nessuna richiesta da altri siti. Secure in produzione: solo su https.

export const COOKIE = "dnd_sessione";

export const tokenDa = (richiesta: FastifyRequest): string | null => richiesta.cookies[COOKIE] ?? null;

export function impostaCookie(richiesta: FastifyRequest, risposta: FastifyReply, token: string) {
  risposta.setCookie(COOKIE, token, {
    path: "/", httpOnly: true, sameSite: "strict", secure: richiesta.server.produzione, maxAge: Math.floor(DURATA_SESSIONE / 1000),
  });
}

export function cancellaCookie(richiesta: FastifyRequest, risposta: FastifyReply) {
  risposta.clearCookie(COOKIE, { path: "/", httpOnly: true, sameSite: "strict", secure: richiesta.server.produzione });
}

// preHandler delle rotte riservate: 401 senza una sessione valida, altrimenti `richiesta.utente`.
export async function richiediUtente(richiesta: FastifyRequest) {
  const token = tokenDa(richiesta);
  richiesta.utente = token ? await leggiSessione(richiesta.server.db, token) : null;
  if (!richiesta.utente) throw new ErroreRichiesta(401, "Accesso richiesto");
}

// Utente della richiesta: da usare solo nelle rotte con `richiediUtente`.
export const utenteDi = (richiesta: FastifyRequest) => {
  if (!richiesta.utente) throw new ErroreRichiesta(401, "Accesso richiesto");
  return richiesta.utente;
};

// Rallenta le risposte a una password sbagliata: indovinarla per tentativi diventa lento.
export const attendiDopoErrore = (richiesta: FastifyRequest) =>
  new Promise(r => setTimeout(r, richiesta.server.attesaErrore));
