import { describe, expect, it } from "vitest";
import {
  apriSessione, cambiaPassword, cambiaUsername, chiudiSessione, creaUtente, DURATA_SESSIONE, errorePassword,
  erroreRegistrazione, erroreUsername, hashPassword, leggiSessione, passwordDiUtente, verificaCredenziali,
} from "../src/accesso.ts";
import { apriArchivio } from "../src/archivio.ts";

const archivioConUtente = () => {
  const db = apriArchivio(":memory:");
  const utente = creaUtente(db, "Prova", "segretissima")!;
  return { db, utente };
};

describe("registrazione", () => {
  it("accetta username semplici e password di almeno 8 caratteri", () => {
    expect(erroreRegistrazione("alan", "segretissima")).toBeNull();
    expect(erroreRegistrazione("Mario.Rossi_2", "12345678")).toBeNull();
  });

  it("rifiuta username troppo corti, lunghi o con caratteri strani", () => {
    expect(erroreRegistrazione("al", "segretissima")).toMatch(/username/);
    expect(erroreRegistrazione("a".repeat(31), "segretissima")).toMatch(/username/);
    expect(erroreRegistrazione("mario rossi", "segretissima")).toMatch(/username/);
  });

  it("rifiuta password corte", () => {
    expect(erroreRegistrazione("alan", "1234567")).toMatch(/password/);
  });

  it("uno username già usato non si registra di nuovo, neanche con maiuscole diverse", () => {
    const { db } = archivioConUtente();
    expect(creaUtente(db, "PROVA", "altrapassword")).toBeNull();
    expect(verificaCredenziali(db, "prova", "segretissima")).not.toBeNull();
  });
});

describe("accesso", () => {
  it("con le credenziali giuste restituisce l'utente", () => {
    const { db, utente } = archivioConUtente();
    expect(verificaCredenziali(db, "prova", "segretissima")).toEqual({ id: utente.id, username: "prova" });
  });

  it("lo username non distingue maiuscole e spazi, la password sì", () => {
    const { db } = archivioConUtente();
    expect(verificaCredenziali(db, "  PROVA ", "segretissima")).not.toBeNull();
    expect(verificaCredenziali(db, "prova", "Segretissima")).toBeNull();
  });

  it("rifiuta password sbagliate e utenti inesistenti", () => {
    const { db } = archivioConUtente();
    expect(verificaCredenziali(db, "prova", "sbagliata")).toBeNull();
    expect(verificaCredenziali(db, "nessuno", "segretissima")).toBeNull();
  });

  it("le password sono salvate solo come hash, con sale casuale", () => {
    const { db } = archivioConUtente();
    expect(String(db.prepare("SELECT hash FROM utenti").get()?.hash)).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hashPassword("segretissima")).not.toBe(hashPassword("segretissima"));
  });
});

describe("sessioni", () => {
  it("una sessione aperta riconosce l'utente", () => {
    const { db, utente } = archivioConUtente();
    const token = apriSessione(db, utente.id, 1000);
    expect(leggiSessione(db, token, 2000)).toEqual(utente);
  });

  it("nell'archivio c'è solo l'impronta del token", () => {
    const { db, utente } = archivioConUtente();
    const token = apriSessione(db, utente.id);
    expect(db.prepare("SELECT token FROM sessioni").get()?.token).not.toBe(token);
  });

  it("un token inventato non vale", () => {
    const { db, utente } = archivioConUtente();
    apriSessione(db, utente.id);
    expect(leggiSessione(db, "inventato")).toBeNull();
  });

  it("scade dopo la durata prevista", () => {
    const { db, utente } = archivioConUtente();
    const token = apriSessione(db, utente.id, 0);
    expect(leggiSessione(db, token, DURATA_SESSIONE - 1)).not.toBeNull();
    expect(leggiSessione(db, token, DURATA_SESSIONE)).toBeNull();
  });

  it("uscendo la sessione si chiude", () => {
    const { db, utente } = archivioConUtente();
    const token = apriSessione(db, utente.id);
    chiudiSessione(db, token);
    expect(leggiSessione(db, token)).toBeNull();
  });
});

describe("modifica dell'account", () => {
  it("la password attuale si verifica per id", () => {
    const { db, utente } = archivioConUtente();
    expect(passwordDiUtente(db, utente.id, "segretissima")).toBe(true);
    expect(passwordDiUtente(db, utente.id, "sbagliata")).toBe(false);
    expect(passwordDiUtente(db, 999, "segretissima")).toBe(false);
  });

  it("cambiando username si accede con quello nuovo; la sessione resta valida", () => {
    const { db, utente } = archivioConUtente();
    const token = apriSessione(db, utente.id);
    expect(cambiaUsername(db, utente.id, " Nuovo.Nome ")).toEqual({ id: utente.id, username: "nuovo.nome" });
    expect(verificaCredenziali(db, "nuovo.nome", "segretissima")?.id).toBe(utente.id);
    expect(verificaCredenziali(db, "prova", "segretissima")).toBeNull();
    expect(leggiSessione(db, token)?.username).toBe("nuovo.nome");
  });

  it("non si prende lo username di un altro, ma si può cambiare solo le maiuscole del proprio", () => {
    const { db, utente } = archivioConUtente();
    creaUtente(db, "altro", "segretissima");
    expect(cambiaUsername(db, utente.id, "ALTRO")).toBeNull();
    expect(cambiaUsername(db, utente.id, "PROVA")).toEqual({ id: utente.id, username: "prova" });
  });

  it("cambiando password vale solo la nuova e si chiudono le sessioni degli altri dispositivi", () => {
    const { db, utente } = archivioConUtente();
    const questo = apriSessione(db, utente.id);
    const altro = apriSessione(db, utente.id);
    cambiaPassword(db, utente.id, "nuova-password", questo);
    expect(verificaCredenziali(db, "prova", "segretissima")).toBeNull();
    expect(verificaCredenziali(db, "prova", "nuova-password")).not.toBeNull();
    expect(leggiSessione(db, questo)).not.toBeNull();
    expect(leggiSessione(db, altro)).toBeNull();
  });

  it("le regole di username e password valgono anche per le modifiche", () => {
    expect(erroreUsername("ab")).toMatch(/username/);
    expect(erroreUsername("nuovo_nome")).toBeNull();
    expect(errorePassword("corta")).toMatch(/password/);
    expect(errorePassword("abbastanza-lunga")).toBeNull();
  });
});
