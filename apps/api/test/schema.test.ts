import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "@dnd/regole/dati/alston.ts";
import { hashPassword, verificaCredenziali } from "../src/accesso.ts";
import { apriArchivio, leggi } from "../src/archivio.ts";
import { aggiornaCataloghi } from "../src/catalogo.ts";
import { elencoPersonaggi } from "../src/personaggi.ts";
import { MIGRAZIONE_V3, MIGRAZIONE_V4, preparaSchema, SCHEMA_V2, VERSIONE_SCHEMA } from "../src/schema.ts";
import { componi } from "../src/personaggi.ts";

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
    expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(VERSIONE_SCHEMA);
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

describe("migrazione dalla versione 3", () => {
  const archivioV3 = () => {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA_V2);
    db.exec(MIGRAZIONE_V3);
    db.exec("PRAGMA user_version = 3");
    db.exec("INSERT INTO utenti (username, hash, creato) VALUES ('alan', 'h', 'oggi')");
    db.exec(`INSERT INTO personaggi (utente_id, revisione, aggiornato, nome, classe, livello, pf_attuali)
             VALUES (1, 4, 'oggi', 'Alston il Breve', 'Mago', 3, 17)`);
    return db;
  };

  it("aggiunge risorse, condizioni, effetti e note vuoti senza toccare i dati", () => {
    const db = archivioV3();
    preparaSchema(db, ":memory:");
    expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(VERSIONE_SCHEMA);
    const alston = componi(db, 1)!;
    expect(alston.combattimento.pfAttuali).toBe(17);
    expect(alston).toMatchObject({ risorseUsate: {}, condizioni: [], indebolimento: 0, effetti: [], note: [] });
    expect(db.prepare("SELECT revisione FROM personaggi WHERE id = 1").get()?.revisione).toBe(4);
  });
});

describe("migrazione dalla versione 4", () => {
  const archivioV4 = (db: DatabaseSync) => {
    db.exec(SCHEMA_V2);
    db.exec(MIGRAZIONE_V3);
    db.exec(MIGRAZIONE_V4);
    db.exec("PRAGMA user_version = 4");
    aggiornaCataloghi(db);
    db.exec("INSERT INTO utenti (username, hash, creato) VALUES ('alan', 'h', 'oggi')");
    db.exec(`INSERT INTO personaggi (utente_id, revisione, aggiornato, nome, classe, livello, pf_attuali)
             VALUES (1, 6, 'oggi', 'Alston il Breve', 'Mago', 3, 17)`);
    db.exec(`INSERT INTO personaggio_armi (personaggio_id, arma_id, ordine)
             SELECT 1, id, CASE nome WHEN 'Bastone Ferrato' THEN 0 ELSE 1 END FROM armi WHERE nome IN ('Bastone Ferrato', 'Pugnale')`);
    db.exec("INSERT INTO personaggio_note (personaggio_id, ordine, id_locale, data, categoria, titolo, testo) VALUES (1, 0, 5, 'ieri', 'png', 'Oste', '')");
  };

  it("conserva le armi (intatte, senza contatori) e le note, e aggiunge avatar e campi", () => {
    const db = new DatabaseSync(":memory:");
    archivioV4(db);
    preparaSchema(db, ":memory:");
    expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(VERSIONE_SCHEMA);
    const alston = componi(db, 1)!;
    expect(alston.armi.map(a => ({ id: a.id, nome: a.nome, bonus: a.bonus, munizioni: a.munizioni, durabilita: a.durabilita, rotta: a.rotta })))
      .toEqual([
        { id: 1, nome: "Bastone Ferrato", bonus: 0, munizioni: null, durabilita: null, rotta: false },
        { id: 2, nome: "Pugnale", bonus: 0, munizioni: null, durabilita: null, rotta: false },
      ]);
    expect(alston.info.avatar).toBe("");
    expect(alston.note).toEqual([{ id: 5, data: "ieri", categoria: "png", titolo: "Oste", testo: "", fatto: false, campi: {} }]);
    expect(db.prepare("SELECT revisione FROM personaggi WHERE id = 1").get()?.revisione).toBe(6);
  });

  it("prima di migrare un archivio su file ne fa una copia", () => {
    const percorso = join(mkdtempSync(join(tmpdir(), "dnd-")), "archivio.sqlite");
    const v4 = new DatabaseSync(percorso);
    archivioV4(v4);
    v4.close();
    apriArchivio(percorso).close();
    expect(existsSync(`${percorso}.bak-v4`)).toBe(true);
  });
});
