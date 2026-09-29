import { describe, expect, it } from "vitest";
import { apriArchivio, leggi, scrivi } from "./archivio.ts";

describe("archivio SQLite", () => {
  it("un personaggio mai salvato non esiste", () => {
    const db = apriArchivio(":memory:");
    expect(leggi(db, "alston")).toBeNull();
  });

  it("la prima scrittura parte dalla revisione 0 e crea la revisione 1", () => {
    const db = apriArchivio(":memory:");
    expect(scrivi(db, "alston", { nome: "Alston" }, 0)).toEqual({ ok: true, revisione: 1 });
    expect(leggi(db, "alston")).toEqual({ dati: { nome: "Alston" }, revisione: 1 });
  });

  it("con la revisione giusta sovrascrive e incrementa", () => {
    const db = apriArchivio(":memory:");
    scrivi(db, "alston", { pf: 10 }, 0);
    expect(scrivi(db, "alston", { pf: 7 }, 1)).toEqual({ ok: true, revisione: 2 });
    expect(leggi(db, "alston")).toEqual({ dati: { pf: 7 }, revisione: 2 });
  });

  it("con una revisione superata rifiuta e restituisce la versione attuale", () => {
    const db = apriArchivio(":memory:");
    scrivi(db, "alston", { pf: 10 }, 0);
    scrivi(db, "alston", { pf: 7 }, 1);
    expect(scrivi(db, "alston", { pf: 3 }, 1)).toEqual({ ok: false, attuale: { dati: { pf: 7 }, revisione: 2 } });
    expect(leggi(db, "alston")?.dati).toEqual({ pf: 7 });
  });

  it("non crea un personaggio se il client crede che esista già", () => {
    const db = apriArchivio(":memory:");
    expect(scrivi(db, "alston", { pf: 10 }, 3)).toEqual({ ok: false, attuale: null });
    expect(leggi(db, "alston")).toBeNull();
  });

  it("tiene separati i personaggi", () => {
    const db = apriArchivio(":memory:");
    scrivi(db, "alston", { nome: "Alston" }, 0);
    expect(leggi(db, "altro")).toBeNull();
  });
});
