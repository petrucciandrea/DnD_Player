import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "@dnd/regole/dati/alston.ts";
import { creaUtente, hashPassword, verificaCredenziali } from "../src/accesso.ts";
import { leggi } from "../src/archivio.ts";
import { importa, leggiEsportazione } from "../src/importa.ts";
import { creaPersonaggio } from "../src/personaggi.ts";
import { archivioDiProva } from "./database.ts";

const esportazione = async () => leggiEsportazione({
  versione: 1,
  utenti: [{ id: 4, username: "alan", hash: await hashPassword("vecchia-password"), creato: "2026-09-29T15:39:29.675Z" }],
  personaggi: [{ id: 7, utenteId: 4, revisione: 281, aggiornato: "2026-10-06T13:06:00.000Z", dati: structuredClone(INITIAL_CHARACTER) }],
});

describe("import dall'archivio SQLite", () => {
  it("conserva id, password, revisione e scheda", async () => {
    const db = await archivioDiProva();
    expect(await importa(db, await esportazione())).toEqual({ utenti: 1, personaggi: 1 });
    expect(await verificaCredenziali(db, "alan", "vecchia-password")).toEqual({ id: 4, username: "alan" });
    const versione = await leggi(db, 7, 4);
    expect(versione?.revisione).toBe(281);
    expect({ ...versione!.dati, incantesimi: [] }).toEqual({ ...INITIAL_CHARACTER, incantesimi: [] });
  });

  it("dopo l'import i nuovi id ripartono oltre quelli importati", async () => {
    const db = await archivioDiProva();
    await importa(db, await esportazione());
    const nuovo = (await creaUtente(db, "nuovo", "segretissima"))!;
    expect(nuovo.id).toBe(5);
    expect(await creaPersonaggio(db, nuovo.id, structuredClone(INITIAL_CHARACTER))).toBe(8);
  });

  it("rifiuta un archivio che ha già utenti, senza scrivere nulla", async () => {
    const db = await archivioDiProva();
    await creaUtente(db, "presente", "segretissima");
    await expect(importa(db, await esportazione())).rejects.toThrow(/già 1 utenti/);
    expect(await verificaCredenziali(db, "alan", "vecchia-password")).toBeNull();
  });

  it("rifiuta un file che non è un'esportazione", () => {
    expect(() => leggiEsportazione({ utenti: [] })).toThrow(/non valida/);
  });
});
