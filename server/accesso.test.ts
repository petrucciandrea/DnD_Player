import { describe, expect, it } from "vitest";
import {
  apriSessione, chiudiSessione, creaUtente, DURATA_SESSIONE, hashPassword, leggiSessione, preparaAccesso,
  verificaCredenziali,
} from "./accesso.ts";
import { apriArchivio } from "./archivio.ts";

const archivioConUtente = () => {
  const db = apriArchivio(":memory:");
  creaUtente(db, "Prova", "segreta", "eroe");
  return db;
};

describe("accesso", () => {
  it("l'archivio nasce con l'utente di Alston, senza password in chiaro", () => {
    const db = apriArchivio(":memory:");
    const riga = db.prepare("SELECT username, hash, personaggio FROM utenti").get();
    expect(riga?.username).toBe("alan");
    expect(riga?.personaggio).toBe("alston");
    expect(String(riga?.hash)).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it("riaprire l'archivio non duplica né sovrascrive gli utenti iniziali", () => {
    const db = apriArchivio(":memory:");
    db.prepare("UPDATE utenti SET hash = ? WHERE username = 'alan'").run(hashPassword("nuova"));
    preparaAccesso(db); // come a ogni riavvio del server
    expect(db.prepare("SELECT COUNT(*) AS n FROM utenti").get()?.n).toBe(1);
    expect(verificaCredenziali(db, "alan", "nuova")?.personaggio).toBe("alston");
  });

  it("con le credenziali giuste restituisce l'utente e il suo personaggio", () => {
    expect(verificaCredenziali(archivioConUtente(), "prova", "segreta")).toEqual({ username: "prova", personaggio: "eroe" });
  });

  it("lo username non distingue maiuscole e spazi, la password sì", () => {
    const db = archivioConUtente();
    expect(verificaCredenziali(db, "  PROVA ", "segreta")).not.toBeNull();
    expect(verificaCredenziali(db, "prova", "Segreta")).toBeNull();
  });

  it("rifiuta password sbagliate e utenti inesistenti", () => {
    const db = archivioConUtente();
    expect(verificaCredenziali(db, "prova", "sbagliata")).toBeNull();
    expect(verificaCredenziali(db, "nessuno", "segreta")).toBeNull();
  });

  it("gli hash della stessa password sono diversi (sale casuale)", () => {
    expect(hashPassword("segreta")).not.toBe(hashPassword("segreta"));
  });
});

describe("sessioni", () => {
  it("una sessione aperta riconosce l'utente", () => {
    const db = archivioConUtente();
    const token = apriSessione(db, "prova", 1000);
    expect(leggiSessione(db, token, 2000)).toEqual({ username: "prova", personaggio: "eroe" });
  });

  it("nell'archivio c'è solo l'impronta del token", () => {
    const db = archivioConUtente();
    const token = apriSessione(db, "prova");
    const riga = db.prepare("SELECT token FROM sessioni").get();
    expect(riga?.token).not.toBe(token);
  });

  it("un token inventato non vale", () => {
    const db = archivioConUtente();
    apriSessione(db, "prova");
    expect(leggiSessione(db, "inventato")).toBeNull();
  });

  it("scade dopo la durata prevista", () => {
    const db = archivioConUtente();
    const token = apriSessione(db, "prova", 0);
    expect(leggiSessione(db, token, DURATA_SESSIONE - 1)).not.toBeNull();
    expect(leggiSessione(db, token, DURATA_SESSIONE)).toBeNull();
  });

  it("uscendo la sessione si chiude", () => {
    const db = archivioConUtente();
    const token = apriSessione(db, "prova");
    chiudiSessione(db, token);
    expect(leggiSessione(db, token)).toBeNull();
  });
});
