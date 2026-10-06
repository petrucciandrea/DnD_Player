import { describe, expect, it } from "vitest";
import { SCHEDE_INCANTESIMI } from "@dnd/regole/semi/incantesimi.ts";
import { aggiornaCataloghi } from "../src/catalogo.ts";
import { opzioniConnessione, riga } from "../src/db.ts";
import { applicaMigrazioni, elencoMigrazioni, versioneSchema } from "../src/migra.ts";
import { archivioDiProva } from "./database.ts";

const conta = async (db: Awaited<ReturnType<typeof archivioDiProva>>, tabella: string) =>
  Number((await riga(db, `SELECT count(*)::int AS n FROM ${tabella}`))?.n);

describe("migrazioni e semina", () => {
  it("un archivio nuovo è all'ultima migrazione, con i cataloghi e senza utenti", async () => {
    const db = await archivioDiProva();
    expect(await versioneSchema(db)).toBe(elencoMigrazioni().at(-1));
    expect(await conta(db, "incantesimi")).toBe(Object.keys(SCHEDE_INCANTESIMI).length);
    expect(await conta(db, "utenti")).toBe(0);
  });

  it("rieseguire migrazioni e semina non cambia nulla", async () => {
    const db = await archivioDiProva();
    const prima = await Promise.all(["incantesimi", "privilegi", "razza_competenze", "classe_privilegi"].map(t => conta(db, t)));
    expect(await applicaMigrazioni(db)).toEqual([]);
    await aggiornaCataloghi(db);
    const dopo = await Promise.all(["incantesimi", "privilegi", "razza_competenze", "classe_privilegi"].map(t => conta(db, t)));
    expect(dopo).toEqual(prima);
  });

  it("la semina corregge le voci ufficiali e lascia stare quelle degli utenti", async () => {
    const db = await archivioDiProva();
    await db.query("INSERT INTO utenti (username, hash) VALUES ('prova', 'x')");
    await db.query("UPDATE incantesimi SET scuola = 'Sbagliata' WHERE nome = 'Scudo'");
    await db.query("INSERT INTO armi (nome, dado, tipo_danno, proprieta, accurata, creato_da) SELECT 'Lancia del Gnomo', '1d8', 'Perforante', '', false, id FROM utenti");
    await aggiornaCataloghi(db);
    expect((await riga(db, "SELECT scuola FROM incantesimi WHERE nome = 'Scudo'"))?.scuola).toBe("Abiurazione");
    expect((await riga(db, "SELECT dado FROM armi WHERE nome = 'lancia del gnomo'"))?.dado).toBe("1d8");
  });
});

describe("connessione", () => {
  it("toglie dall'URL di Neon i parametri che node-postgres non gestisce e attiva l'SSL verificato", () => {
    const o = opzioniConnessione("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
    expect(o.connectionString).toBe("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb");
    expect(o.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("senza sslmode (il Postgres locale) niente SSL", () => {
    expect(opzioniConnessione("postgres://dnd:dnd@localhost:5440/dnd")).toEqual({ connectionString: "postgres://dnd:dnd@localhost:5440/dnd" });
  });
});
