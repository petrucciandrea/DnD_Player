import { ErroreRichiesta } from "./errori.ts";

export const MASSIMO_INTERO = 2_147_483_647; // integer di PostgreSQL

export const interoValido = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MASSIMO_INTERO;

// Id dal percorso; uno che non può esistere vale come risorsa inesistente (404).
export function idDa(parametro: string, messaggio = "Risorsa inesistente"): number {
  const id = /^\d{1,10}$/.test(parametro) ? Number(parametro) : NaN;
  if (!(id >= 1 && id <= MASSIMO_INTERO)) throw new ErroreRichiesta(404, messaggio);
  return id;
}
