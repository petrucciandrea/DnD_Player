// Errore da mostrare all'utente, con il codice HTTP: il gestore degli errori risponde { errore: messaggio }.
export class ErroreRichiesta extends Error {
  readonly stato: number;
  constructor(stato: number, messaggio: string) {
    super(messaggio);
    this.stato = stato;
  }
}

// Corpo JSON della richiesta come oggetto; tutto il resto è un errore 400.
export function corpoOggetto(corpo: unknown): Record<string, unknown> {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) throw new ErroreRichiesta(400, "JSON non valido");
  return corpo as Record<string, unknown>;
}
