import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "@dnd/regole/dati/alston.ts";
import { creaUtente } from "../src/accesso.ts";
import { leggi, scrivi } from "../src/archivio.ts";
import { creaPersonaggio } from "../src/personaggi.ts";
import { archivioDiProva } from "./database.ts";

const conAlston = async () => {
  const db = await archivioDiProva();
  const utente = (await creaUtente(db, "prova", "segretissima"))!;
  const id = await creaPersonaggio(db, utente.id, structuredClone(INITIAL_CHARACTER));
  return { db, utente, id };
};

const conPF = (pf: number) => {
  const c = structuredClone(INITIAL_CHARACTER);
  c.combattimento.pfAttuali = pf;
  return c;
};

describe("archivio: revisioni", () => {
  it("un personaggio nuovo parte dalla revisione 1", async () => {
    const { db, utente, id } = await conAlston();
    expect((await leggi(db, id, utente.id))?.revisione).toBe(1);
  });

  it("con la revisione giusta sovrascrive e incrementa", async () => {
    const { db, utente, id } = await conAlston();
    expect(await scrivi(db, id, utente.id, conPF(7), 1)).toEqual({ ok: true, revisione: 2 });
    expect((await leggi(db, id, utente.id))?.dati.combattimento.pfAttuali).toBe(7);
  });

  it("con una revisione superata rifiuta e restituisce la versione attuale", async () => {
    const { db, utente, id } = await conAlston();
    await scrivi(db, id, utente.id, conPF(7), 1);
    const esito = await scrivi(db, id, utente.id, conPF(3), 1);
    expect(esito.ok).toBe(false);
    expect(!esito.ok && esito.attuale?.revisione).toBe(2);
    expect(!esito.ok && esito.attuale?.dati.combattimento.pfAttuali).toBe(7);
    expect((await leggi(db, id, utente.id))?.dati.combattimento.pfAttuali).toBe(7);
  });

  it("un personaggio inesistente non si legge né si scrive", async () => {
    const { db, utente } = await conAlston();
    expect(await leggi(db, 999, utente.id)).toBeNull();
    expect(await scrivi(db, 999, utente.id, conPF(1), 1)).toEqual({ ok: false, attuale: null });
  });

  it("un utente non legge né scrive i personaggi di un altro", async () => {
    const { db, id } = await conAlston();
    const altro = (await creaUtente(db, "altro", "segretissima"))!;
    expect(await leggi(db, id, altro.id)).toBeNull();
    expect(await scrivi(db, id, altro.id, conPF(1), 1)).toEqual({ ok: false, attuale: null });
  });

  it("due scritture concorrenti con la stessa revisione: ne passa una sola", async () => {
    const { db, utente, id } = await conAlston();
    const esiti = await Promise.all([scrivi(db, id, utente.id, conPF(7), 1), scrivi(db, id, utente.id, conPF(3), 1)]);
    expect(esiti.filter(e => e.ok)).toEqual([{ ok: true, revisione: 2 }]);
    const vincente = esiti[0].ok ? 7 : 3;
    expect((await leggi(db, id, utente.id))?.dati.combattimento.pfAttuali).toBe(vincente);
  });
});
