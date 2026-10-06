import { describe, expect, it } from "vitest";
import {
  apriSessione, cambiaPassword, cambiaUsername, chiudiSessione, creaUtente, DURATA_SESSIONE, errorePassword,
  erroreRegistrazione, erroreUsername, hashPassword, leggiSessione, passwordDiUtente, verificaCredenziali,
} from "../src/accesso.ts";
import { riga } from "../src/db.ts";
import { archivioDiProva } from "./database.ts";

const archivioConUtente = async () => {
  const db = await archivioDiProva();
  const utente = (await await creaUtente(db, "Prova", "segretissima"))!;
  return { db, utente };
};

describe("registrazione", () => {
  it("accetta username semplici e password di almeno 8 caratteri", async () => {
    expect(erroreRegistrazione("alan", "segretissima")).toBeNull();
    expect(erroreRegistrazione("Mario.Rossi_2", "12345678")).toBeNull();
  });

  it("rifiuta username troppo corti, lunghi o con caratteri strani", async () => {
    expect(erroreRegistrazione("al", "segretissima")).toMatch(/username/);
    expect(erroreRegistrazione("a".repeat(31), "segretissima")).toMatch(/username/);
    expect(erroreRegistrazione("mario rossi", "segretissima")).toMatch(/username/);
  });

  it("rifiuta password corte", async () => {
    expect(erroreRegistrazione("alan", "1234567")).toMatch(/password/);
  });

  it("uno username già usato non si registra di nuovo, neanche con maiuscole diverse", async () => {
    const { db } = await archivioConUtente();
    expect(await creaUtente(db, "PROVA", "altrapassword")).toBeNull();
    expect(await verificaCredenziali(db, "prova", "segretissima")).not.toBeNull();
  });
});

describe("accesso", () => {
  it("con le credenziali giuste restituisce l'utente", async () => {
    const { db, utente } = await archivioConUtente();
    expect(await verificaCredenziali(db, "prova", "segretissima")).toEqual({ id: utente.id, username: "prova" });
  });

  it("lo username non distingue maiuscole e spazi, la password sì", async () => {
    const { db } = await archivioConUtente();
    expect(await verificaCredenziali(db, "  PROVA ", "segretissima")).not.toBeNull();
    expect(await verificaCredenziali(db, "prova", "Segretissima")).toBeNull();
  });

  it("rifiuta password sbagliate e utenti inesistenti", async () => {
    const { db } = await archivioConUtente();
    expect(await verificaCredenziali(db, "prova", "sbagliata")).toBeNull();
    expect(await verificaCredenziali(db, "nessuno", "segretissima")).toBeNull();
  });

  it("le password sono salvate solo come hash, con sale casuale", async () => {
    const { db } = await archivioConUtente();
    expect(String((await riga(db, "SELECT hash FROM utenti"))?.hash)).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(await hashPassword("segretissima")).not.toBe(await hashPassword("segretissima"));
  });
});

describe("sessioni", () => {
  it("una sessione aperta riconosce l'utente", async () => {
    const { db, utente } = await archivioConUtente();
    const token = await apriSessione(db, utente.id, 1000);
    expect(await leggiSessione(db, token, 2000)).toEqual(utente);
  });

  it("nell'archivio c'è solo l'impronta del token", async () => {
    const { db, utente } = await archivioConUtente();
    const token = await apriSessione(db, utente.id);
    expect((await riga(db, "SELECT token FROM sessioni"))?.token).not.toBe(token);
  });

  it("un token inventato non vale", async () => {
    const { db, utente } = await archivioConUtente();
    await apriSessione(db, utente.id);
    expect(await leggiSessione(db, "inventato")).toBeNull();
  });

  it("scade dopo la durata prevista", async () => {
    const { db, utente } = await archivioConUtente();
    const token = await apriSessione(db, utente.id, 0);
    expect(await leggiSessione(db, token, DURATA_SESSIONE - 1)).not.toBeNull();
    expect(await leggiSessione(db, token, DURATA_SESSIONE)).toBeNull();
  });

  it("uscendo la sessione si chiude", async () => {
    const { db, utente } = await archivioConUtente();
    const token = await apriSessione(db, utente.id);
    await chiudiSessione(db, token);
    expect(await leggiSessione(db, token)).toBeNull();
  });
});

describe("modifica dell'account", () => {
  it("la password attuale si verifica per id", async () => {
    const { db, utente } = await archivioConUtente();
    expect(await passwordDiUtente(db, utente.id, "segretissima")).toBe(true);
    expect(await passwordDiUtente(db, utente.id, "sbagliata")).toBe(false);
    expect(await passwordDiUtente(db, 999, "segretissima")).toBe(false);
  });

  it("cambiando username si accede con quello nuovo; la sessione resta valida", async () => {
    const { db, utente } = await archivioConUtente();
    const token = await apriSessione(db, utente.id);
    expect(await cambiaUsername(db, utente.id, " Nuovo.Nome ")).toEqual({ id: utente.id, username: "nuovo.nome" });
    expect((await verificaCredenziali(db, "nuovo.nome", "segretissima"))?.id).toBe(utente.id);
    expect(await verificaCredenziali(db, "prova", "segretissima")).toBeNull();
    expect((await leggiSessione(db, token))?.username).toBe("nuovo.nome");
  });

  it("non si prende lo username di un altro, ma si può cambiare solo le maiuscole del proprio", async () => {
    const { db, utente } = await archivioConUtente();
    await creaUtente(db, "altro", "segretissima");
    expect(await cambiaUsername(db, utente.id, "ALTRO")).toBeNull();
    expect(await cambiaUsername(db, utente.id, "PROVA")).toEqual({ id: utente.id, username: "prova" });
  });

  it("cambiando password vale solo la nuova e si chiudono le sessioni degli altri dispositivi", async () => {
    const { db, utente } = await archivioConUtente();
    const questo = await apriSessione(db, utente.id);
    const altro = await apriSessione(db, utente.id);
    await cambiaPassword(db, utente.id, "nuova-password", questo);
    expect(await verificaCredenziali(db, "prova", "segretissima")).toBeNull();
    expect(await verificaCredenziali(db, "prova", "nuova-password")).not.toBeNull();
    expect(await leggiSessione(db, questo)).not.toBeNull();
    expect(await leggiSessione(db, altro)).toBeNull();
  });

  it("le regole di username e password valgono anche per le modifiche", async () => {
    expect(erroreUsername("ab")).toMatch(/username/);
    expect(erroreUsername("nuovo_nome")).toBeNull();
    expect(errorePassword("corta")).toMatch(/password/);
    expect(errorePassword("abbastanza-lunga")).toBeNull();
  });
});
