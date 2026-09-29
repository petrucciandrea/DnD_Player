import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "../src/dati/alston.ts";
import { hashPassword, verificaCredenziali } from "./accesso.ts";
import { apriArchivio, leggi } from "./archivio.ts";
import { aggiornaCataloghi } from "./catalogo.ts";
import { elencoPersonaggi } from "./personaggi.ts";
import { preparaSchema, SCHEMA_V2, VERSIONE_SCHEMA } from "./schema.ts";
import { componi } from "./personaggi.ts";

// Archivio come lo lasciava la versione 1 dell'app.
function archivioV1(db: DatabaseSync, { conUtenti = true } = {}) {
  db.exec(`
    CREATE TABLE personaggi (id TEXT PRIMARY KEY, dati TEXT NOT NULL, revisione INTEGER NOT NULL, aggiornato TEXT NOT NULL);
  `);
  const alston = structuredClone(INITIAL_CHARACTER);
  alston.combattimento.pfAttuali = 11;
  db.prepare("INSERT INTO personaggi VALUES ('alston', ?, 7, '2026-09-29T11:04:16.201Z')").run(JSON.stringify(alston));
  if (!conUtenti) return;
  db.exec(`
    CREATE TABLE utenti (username TEXT PRIMARY KEY, hash TEXT NOT NULL, personaggio TEXT NOT NULL);
    CREATE TABLE sessioni (token TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES utenti(username) ON DELETE CASCADE, scadenza INTEGER NOT NULL);
  `);
  db.prepare("INSERT INTO utenti VALUES ('alan', ?, 'alston')").run(hashPassword("vecchia-password"));
  db.prepare("INSERT INTO sessioni VALUES ('x', 'alan', 0)").run();
}

describe("schema e migrazione", () => {
  it("un archivio nuovo nasce alla versione attuale, con i cataloghi e senza utenti", () => {
    const db = apriArchivio(":memory:");
    expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(VERSIONE_SCHEMA);
    expect(Number(db.prepare("SELECT COUNT(*) AS n FROM incantesimi").get()?.n)).toBeGreaterThan(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM utenti").get()?.n).toBe(0);
  });

  it("migra la versione 1: stesso utente, stessa password, stessa scheda e revisione", () => {
    const db = new DatabaseSync(":memory:");
    archivioV1(db);
    preparaSchema(db, ":memory:");

    const alan = verificaCredenziali(db, "alan", "vecchia-password")!;
    expect(alan.username).toBe("alan");
    const [personaggio] = elencoPersonaggi(db, alan.id);
    const versione = leggi(db, personaggio.id, alan.id)!;
    expect(versione.revisione).toBe(7);
    expect(versione.dati.combattimento.pfAttuali).toBe(11);
    expect(versione.dati.incantesimi).toHaveLength(INITIAL_CHARACTER.incantesimi.length);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'v1_%'").all()).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessioni").get()?.n).toBe(0); // si rifà il login
  });

  it("migra anche un archivio v1 creato prima del login, collegando Alston ad alan", () => {
    const db = new DatabaseSync(":memory:");
    archivioV1(db, { conUtenti: false });
    preparaSchema(db, ":memory:");
    const alan = db.prepare("SELECT id FROM utenti WHERE username = 'alan'").get()!;
    expect(elencoPersonaggi(db, Number(alan.id)).map(p => p.nome)).toEqual(["Alston il Breve"]);
  });

  it("prima di migrare un archivio su file ne fa una copia", () => {
    const percorso = join(mkdtempSync(join(tmpdir(), "dnd-")), "archivio.sqlite");
    const v1 = new DatabaseSync(percorso);
    archivioV1(v1);
    v1.close();
    apriArchivio(percorso).close();
    expect(existsSync(`${percorso}.bak-v1`)).toBe(true);
  });

  it("riaprire un archivio aggiornato non migra di nuovo", () => {
    const db = new DatabaseSync(":memory:");
    archivioV1(db);
    preparaSchema(db, ":memory:");
    preparaSchema(db, ":memory:");
    expect(db.prepare("SELECT COUNT(*) AS n FROM personaggi").get()?.n).toBe(1);
  });

  it("i seed aggiornano le voci ufficiali ma non quelle degli utenti", () => {
    const db = apriArchivio(":memory:");
    db.prepare("UPDATE incantesimi SET descrizione = 'vecchia' WHERE nome = 'Scudo'").run();
    db.exec("INSERT INTO utenti (username, hash, creato) VALUES ('u', 'h', 'oggi')");
    db.prepare("UPDATE incantesimi SET descrizione = 'mia', creato_da = 1 WHERE nome = 'Mani Brucianti'").run();
    aggiornaCataloghi(db);
    expect(db.prepare("SELECT descrizione FROM incantesimi WHERE nome = 'Scudo'").get()?.descrizione).not.toBe("vecchia");
    expect(db.prepare("SELECT descrizione FROM incantesimi WHERE nome = 'Mani Brucianti'").get()?.descrizione).toBe("mia");
  });
});

describe("migrazione dalla versione 2", () => {
  const archivioV2 = () => {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA_V2);
    db.exec("PRAGMA user_version = 2");
    db.exec("INSERT INTO utenti (username, hash, creato) VALUES ('alan', 'h', 'oggi')");
    db.exec(`INSERT INTO personaggi (utente_id, revisione, aggiornato, nome, razza, pf_attuali)
             VALUES (1, 5, 'oggi', 'Alston il Breve', 'Gnomo delle Rocce', 17)`);
    db.exec("INSERT INTO personaggi (utente_id, revisione, aggiornato, nome, razza) VALUES (1, 1, 'oggi', 'Senza razza', 'Boh')");
    return db;
  };

  it("aggiunge tabelle e colonne senza toccare i dati", () => {
    const db = archivioV2();
    preparaSchema(db, ":memory:");
    expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(3);
    const alston = componi(db, 1)!;
    expect(alston.combattimento.pfAttuali).toBe(17);
    expect(db.prepare("SELECT revisione FROM personaggi WHERE id = 1").get()?.revisione).toBe(5);
    expect(alston.armatura).toBeNull();
    expect(alston.scudo).toBe(false);
  });

  it("ricava taglia e lingue dalla razza del catalogo", () => {
    const db = archivioV2();
    preparaSchema(db, ":memory:");
    const alston = componi(db, 1)!;
    expect(alston.info.taglia).toBe("Piccola"); // dalla razza madre Gnomo
    expect(alston.competenzeAltre.lingue).toEqual(["Comune", "Gnomesco"]);
    const altro = componi(db, 2)!;
    expect(altro.info.taglia).toBe("Media");
    expect(altro.competenzeAltre.lingue).toEqual([]);
  });
});
