import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "../src/dati/alston.ts";
import { creaUtente } from "./accesso.ts";
import { apriArchivio, leggi, scrivi } from "./archivio.ts";
import { creaPersonaggio } from "./personaggi.ts";

const conAlston = () => {
  const db = apriArchivio(":memory:");
  const utente = creaUtente(db, "prova", "segretissima")!;
  const id = creaPersonaggio(db, utente.id, structuredClone(INITIAL_CHARACTER));
  return { db, utente, id };
};

const conPF = (pf: number) => {
  const c = structuredClone(INITIAL_CHARACTER);
  c.combattimento.pfAttuali = pf;
  return c;
};

describe("archivio: revisioni", () => {
  it("un personaggio nuovo parte dalla revisione 1", () => {
    const { db, utente, id } = conAlston();
    expect(leggi(db, id, utente.id)?.revisione).toBe(1);
  });

  it("con la revisione giusta sovrascrive e incrementa", () => {
    const { db, utente, id } = conAlston();
    expect(scrivi(db, id, utente.id, conPF(7), 1)).toEqual({ ok: true, revisione: 2 });
    expect(leggi(db, id, utente.id)?.dati.combattimento.pfAttuali).toBe(7);
  });

  it("con una revisione superata rifiuta e restituisce la versione attuale", () => {
    const { db, utente, id } = conAlston();
    scrivi(db, id, utente.id, conPF(7), 1);
    const esito = scrivi(db, id, utente.id, conPF(3), 1);
    expect(esito.ok).toBe(false);
    expect(!esito.ok && esito.attuale?.revisione).toBe(2);
    expect(!esito.ok && esito.attuale?.dati.combattimento.pfAttuali).toBe(7);
    expect(leggi(db, id, utente.id)?.dati.combattimento.pfAttuali).toBe(7);
  });

  it("un personaggio inesistente non si legge né si scrive", () => {
    const { db, utente } = conAlston();
    expect(leggi(db, 999, utente.id)).toBeNull();
    expect(scrivi(db, 999, utente.id, conPF(1), 1)).toEqual({ ok: false, attuale: null });
  });

  it("un utente non legge né scrive i personaggi di un altro", () => {
    const { db, id } = conAlston();
    const altro = creaUtente(db, "altro", "segretissima")!;
    expect(leggi(db, id, altro.id)).toBeNull();
    expect(scrivi(db, id, altro.id, conPF(1), 1)).toEqual({ ok: false, attuale: null });
  });
});
