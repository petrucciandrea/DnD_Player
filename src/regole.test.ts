import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "./dati/alston";
import {
  bonusCompetenza, derivate, formulaDanno, modificaCaratteristica, modificatore,
  riposoBreve, riposoLungo, risultatoD20, saliDiLivello,
} from "./regole";
import { daJSON } from "./salvataggio";
import type { CharacterData } from "./tipi";

const alston = (): CharacterData => structuredClone(INITIAL_CHARACTER);

describe("valori base", () => {
  it("modificatore e bonus di competenza", () => {
    expect([1, 8, 9, 10, 11, 17, 20].map(modificatore)).toEqual([-5, -1, -1, 0, 0, 3, 5]);
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(bonusCompetenza)).toEqual([2, 2, 3, 3, 4, 5, 6, 6]);
  });

  it("formula del danno", () => {
    expect(formulaDanno("1d4", 1)).toBe("1d4 + 1");
    expect(formulaDanno("1d6", -1)).toBe("1d6 - 1");
    expect(formulaDanno("1d8", 0)).toBe("1d8");
  });
});

describe("derivate di Alston (Mago 3)", () => {
  const d = derivate(alston());

  it("statistiche di combattimento", () => {
    expect(d.comp).toBe(2);
    expect(d.ca).toBe(11);
    expect(d.iniziativa).toBe(1);
    expect(d.cdMagia).toBe(13);
    expect(d.attaccoMagico).toBe(5);
    expect(d.percezionePassiva).toBe(11);
  });

  it("tiri salvezza e abilità", () => {
    expect(d.ts("INT")).toBe(5);
    expect(d.ts("SAG")).toBe(3);
    expect(d.ts("FOR")).toBe(-1);
    expect(d.abilita("arcano")).toBe(5);
    expect(d.abilita("intuizione")).toBe(3);
    expect(d.abilita("atletica")).toBe(-1);
  });

  it("incantesimi e armi", () => {
    expect(d.slotMax).toEqual([4, 2]);
    expect(d.maxPreparabili).toBe(6);
    expect(d.maxTrucchetti).toBe(3);
    expect(d.attaccoArma(INITIAL_CHARACTER.armi[0])).toEqual({ bonus: 1, mod: -1 }); // bastone: FOR
    expect(d.attaccoArma(INITIAL_CHARACTER.armi[1])).toEqual({ bonus: 3, mod: 1 }); // pugnale: accurata
  });

  it("progressione", () => {
    expect(d.prossimaSoglia).toBe(2700);
    expect(d.puoSalire).toBe(false);
    expect(d.budgetRecuperoArcano).toBe(2);
    expect(d.dadiVitaRecuperati).toBe(1);
  });
});

describe("riposi", () => {
  it("riposo lungo: PF pieni, metà dei Dadi Vita, slot e Presagio", () => {
    const c = alston();
    c.combattimento.pfAttuali = 5;
    c.combattimento.dadiVitaRimanenti = 0;
    c.slotSpesi = [3, 2, 0, 0, 0, 0, 0, 0, 0];
    c.recuperoArcanoUsato = true;
    const r = riposoLungo(c, [7, 13]);
    expect(r.combattimento.pfAttuali).toBe(23);
    expect(r.combattimento.dadiVitaRimanenti).toBe(1);
    expect(r.slotSpesi.every(s => s === 0)).toBe(true);
    expect(r.divinazione).toEqual({ presagio: [7, 13], usati: [false, false] });
    expect(r.recuperoArcanoUsato).toBe(false);
  });

  it("riposo breve: PF limitati al massimo, Dadi Vita e slot recuperati", () => {
    const c = alston();
    c.combattimento.pfAttuali = 20;
    c.slotSpesi = [2, 1, 0, 0, 0, 0, 0, 0, 0];
    const r = riposoBreve(c, { dadiVitaSpesi: 2, pfRecuperati: 15, slotRecuperati: [0, 1] });
    expect(r.combattimento.pfAttuali).toBe(23);
    expect(r.combattimento.dadiVitaRimanenti).toBe(1);
    expect(r.slotSpesi.slice(0, 2)).toEqual([2, 0]);
    expect(r.recuperoArcanoUsato).toBe(true);
  });

  it("riposo breve senza Recupero Arcano non lo consuma", () => {
    const r = riposoBreve(alston(), { dadiVitaSpesi: 0, pfRecuperati: 0, slotRecuperati: [] });
    expect(r.recuperoArcanoUsato).toBe(false);
  });
});

describe("livelli e caratteristiche", () => {
  it("salita al 4° livello", () => {
    const c = saliDiLivello(alston());
    const d = derivate(c);
    expect(c.info.livello).toBe(4);
    expect(c.combattimento.pfMassimi).toBe(30);
    expect(c.combattimento.dadiVitaRimanenti).toBe(4);
    expect(d.slotMax).toEqual([4, 3]);
    expect(d.maxPreparabili).toBe(7);
    expect(d.maxTrucchetti).toBe(4);
  });

  it("la COS modifica retroattivamente i PF massimi", () => {
    const giu = modificaCaratteristica(alston(), "COS", -1); // 16 → 15, mod 3 → 2
    expect(giu.combattimento.pfMassimi).toBe(20);
    const su = modificaCaratteristica(alston(), "COS", 1); // 16 → 17, mod invariato
    expect(su.combattimento.pfMassimi).toBe(23);
  });
});

describe("salvataggio", () => {
  it("migra il formato senza versione", () => {
    const c = daJSON({
      info: { ...INITIAL_CHARACTER.info, ispirazione: 1, bonusCompetenza: 2 },
      caratteristiche: { INT: { valore: 17, mod: 3, ts: 5, compTS: true } },
      combattimento: { pfAttuali: 12, pfMassimi: 23 },
      slot: { livello1: { max: 4, spesi: 3 }, livello2: { max: 2, spesi: 1 } },
      incantesimi: [{ id: 1, nome: "Dardo di Fuoco", livello: 0, scuola: "Evocazione", tempo: "1 Azione", preparato: true, nelGrimorio: true }],
    });
    expect(c.versione).toBe(2);
    expect(c.info.ispirazione).toBe(true);
    expect("bonusCompetenza" in c.info).toBe(false);
    expect(c.caratteristiche.INT).toEqual({ valore: 17, compTS: true });
    expect(c.caratteristiche.FOR.valore).toBe(8); // completata dai dati iniziali
    expect(c.combattimento.pfAttuali).toBe(12);
    expect(c.slotSpesi.slice(0, 3)).toEqual([3, 1, 0]);
    expect(c.incantesimi[0].scuola).toBe("Invocazione");
    expect("nelGrimorio" in c.incantesimi[0]).toBe(false);
  });

  it("rifiuta dati non validi", () => {
    expect(() => daJSON({ a: 1 })).toThrow();
    expect(() => daJSON(null)).toThrow();
  });
});

describe("vantaggio e svantaggio", () => {
  it("tiene il d20 giusto", () => {
    expect(risultatoD20([14], "normale")).toBe(14);
    expect(risultatoD20([6, 14], "vantaggio")).toBe(14);
    expect(risultatoD20([6, 14], "svantaggio")).toBe(6);
  });
});
