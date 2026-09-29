import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "./dati/alston";
import {
  bonusCompetenza, critico, dannoArma, derivate, formulaDanno, modificaCaratteristica, modificatore, parseDado, testoDanni, totaleDanni,
  riposoBreve, riposoLungo, risultatoD20, saliDiLivello,
  dannoIncantesimo, lanciaIncantesimo, numeroAttacchi, slotUtilizzabili,
  applicaCura, applicaDanno, cdConcentrazione, esitoTsMorte, statoVita, pfPerLivello, slotPatto,
} from "./regole";
import { completaConEsistente, daJSON } from "./scheda";
import { SCHEDE_INCANTESIMI } from "../server/semi/incantesimi.ts";
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
    expect(c.caratteristiche.FOR.valore).toBe(10); // completata con il modello vuoto
    expect(c.combattimento.pfAttuali).toBe(12);
    expect(c.combattimento.tsMorte).toEqual({ successi: 0, fallimenti: 0 }); // campi aggiunti dopo
    expect(c.concentrazione).toBeNull();
    expect(c.slotSpesi.slice(0, 3)).toEqual([3, 1, 0]);
    expect(c.incantesimi[0].scuola).toBe("Invocazione");
    expect("nelGrimorio" in c.incantesimi[0]).toBe(false);
  });

  it("i campi che un client vecchio non invia restano quelli salvati", () => {
    const salvata = alston();
    const vecchia = JSON.parse(JSON.stringify(salvata));
    delete vecchia.competenzeAltre;
    delete vecchia.info.taglia;
    vecchia.combattimento.pfAttuali = 5; // la modifica fatta dal client vecchio
    const unita = daJSON(completaConEsistente(vecchia, salvata));
    expect(unita.info.taglia).toBe("Piccola");
    expect(unita.competenzeAltre).toEqual(salvata.competenzeAltre);
    expect(unita.combattimento.pfAttuali).toBe(5);
    // Un campo inviato esplicitamente vince sempre, anche se vuoto.
    expect(daJSON(completaConEsistente({ ...vecchia, armatura: null, scudo: false }, { ...salvata, scudo: true })).scudo).toBe(false);
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

describe("danni", () => {
  const [bastone, pugnale] = INITIAL_CHARACTER.armi;

  it("armi, versatile e critico", () => {
    expect(dannoArma(pugnale, 1)).toEqual({ numero: 1, facce: 4, mod: 1, tipo: "perforanti" });
    expect(dannoArma(bastone, -1, true)).toEqual({ numero: 1, facce: 8, mod: -1, tipo: "contundenti" });
    expect(critico(dannoArma(pugnale, 1))).toEqual({ numero: 2, facce: 4, mod: 1, tipo: "perforanti" });
    expect(testoDanni({ numero: 3, facce: 4, mod: 3, tipo: "forza" })).toBe("3d4 + 3");
  });

  it("il totale non scende sotto 0", () => {
    expect(totaleDanni([3, 4], 1)).toBe(8);
    expect(totaleDanni([1], -1)).toBe(0);
  });

  it("parseDado rifiuta formati non validi", () => {
    expect(parseDado("2d6")).toEqual({ numero: 2, facce: 6 });
    expect(() => parseDado("d6+1")).toThrow();
  });
});

describe("incantesimi", () => {
  const s = (nome: string) => SCHEDE_INCANTESIMI[nome];

  it("trucchetti crescono con il livello del personaggio", () => {
    expect(dannoIncantesimo(s("Dardo di Fuoco"), 0, 3)).toMatchObject({ numero: 1, facce: 10 });
    expect(dannoIncantesimo(s("Dardo di Fuoco"), 0, 5)).toMatchObject({ numero: 2, facce: 10 });
    expect(dannoIncantesimo(s("Tocco Gelido"), 0, 17)).toMatchObject({ numero: 4, facce: 8 });
  });

  it("slot di livello superiore", () => {
    expect(dannoIncantesimo(s("Dardo Incantato"), 1, 3)).toMatchObject({ numero: 3, facce: 4, mod: 3 });
    expect(dannoIncantesimo(s("Dardo Incantato"), 2, 3)).toMatchObject({ numero: 4, facce: 4, mod: 4 });
    expect(dannoIncantesimo(s("Mani Brucianti"), 2, 3)).toMatchObject({ numero: 4, facce: 6, mod: 0 });
    expect(numeroAttacchi(s("Raggio Rovente"), 2)).toBe(3);
    expect(numeroAttacchi(s("Raggio Rovente"), 3)).toBe(4);
    expect(dannoIncantesimo(s("Scudo"), 1, 3)).toBeNull();
  });

  it("lanciare spende uno slot solo se disponibile", () => {
    const c = alston();
    expect(slotUtilizzabili(c, 1)).toEqual([1, 2]);
    expect(slotUtilizzabili(c, 2)).toEqual([2]);
    const dopo = lanciaIncantesimo(lanciaIncantesimo(c, 2), 2);
    expect(dopo.slotSpesi.slice(0, 2)).toEqual([0, 2]);
    expect(slotUtilizzabili(dopo, 2)).toEqual([]);
    expect(lanciaIncantesimo(dopo, 2)).toBe(dopo); // nessuno slot libero
    expect(lanciaIncantesimo(c, null)).toBe(c); // trucchetto o rituale
  });
});

describe("danni, cure e tiri salvezza contro morte", () => {
  const conPF = (pf: number, temp = 0) => {
    const c = alston();
    c.combattimento.pfAttuali = pf;
    c.combattimento.pfTemporanei = temp;
    return c;
  };

  it("i PF temporanei assorbono per primi", () => {
    const c = applicaDanno(conPF(20, 3), 5);
    expect(c.combattimento).toMatchObject({ pfAttuali: 18, pfTemporanei: 0 });
  });

  it("a 0 PF si perde la concentrazione e si inizia a morire", () => {
    const c = { ...conPF(5), concentrazione: "Blocca Persone" };
    const dopo = applicaDanno(c, 8);
    expect(dopo.combattimento.pfAttuali).toBe(0);
    expect(dopo.concentrazione).toBeNull();
    expect(statoVita(dopo)).toBe("morente");
  });

  it("danno massiccio: morte istantanea", () => {
    expect(statoVita(applicaDanno(conPF(5), 5 + 23))).toBe("morto");
    expect(statoVita(applicaDanno(conPF(5), 5 + 22))).toBe("morente");
  });

  it("danni subiti a 0 PF contano come fallimento", () => {
    const c = applicaDanno(applicaDanno(conPF(1), 1), 3);
    expect(c.combattimento.tsMorte).toEqual({ successi: 0, fallimenti: 1 });
  });

  it("esiti dei tiri salvezza contro morte", () => {
    const morente = applicaDanno(conPF(1), 1);
    expect(esitoTsMorte(morente, 12).combattimento.tsMorte).toEqual({ successi: 1, fallimenti: 0 });
    expect(esitoTsMorte(morente, 9).combattimento.tsMorte).toEqual({ successi: 0, fallimenti: 1 });
    expect(esitoTsMorte(morente, 1).combattimento.tsMorte).toEqual({ successi: 0, fallimenti: 2 });
    expect(esitoTsMorte(morente, 20).combattimento.pfAttuali).toBe(1);
    const tre = [15, 11, 10].reduce(esitoTsMorte, morente);
    expect(statoVita(tre)).toBe("stabile");
    const morto = [1, 5].reduce(esitoTsMorte, morente);
    expect(statoVita(morto)).toBe("morto");
    expect(applicaCura(morto, 10)).toBe(morto);
  });

  it("la cura rialza e azzera i tiri contro morte", () => {
    const c = applicaCura(esitoTsMorte(applicaDanno(conPF(1), 1), 5), 4);
    expect(c.combattimento).toMatchObject({ pfAttuali: 4, tsMorte: { successi: 0, fallimenti: 0 } });
    expect(applicaCura(conPF(20), 10).combattimento.pfAttuali).toBe(23);
  });

  it("CD della concentrazione", () => {
    expect(cdConcentrazione(7)).toBe(10);
    expect(cdConcentrazione(25)).toBe(12);
  });

  it("lanciare un incantesimo di concentrazione la imposta", () => {
    const c = lanciaIncantesimo(alston(), 2, { concentrazione: "Blocca Persone" });
    expect(c.concentrazione).toBe("Blocca Persone");
    expect(lanciaIncantesimo(c, null, { concentrazione: "Individuazione del Magico" }).concentrazione).toBe("Individuazione del Magico");
    expect(riposoBreve(c, { dadiVitaSpesi: 0, pfRecuperati: 0, slotRecuperati: [] }).concentrazione).toBeNull();
  });
});

describe("regole per classe", () => {
  // Un personaggio di esempio con classe, livello e punteggi scelti.
  const pg = (classe: string, livello: number, punteggi: Partial<Record<"FOR" | "DES" | "COS" | "INT" | "SAG" | "CAR", number>> = {}, sottoclasse = ""): CharacterData => {
    const c = alston();
    c.info = { ...c.info, classe, livello, sottoclasse, razza: "Umano" };
    for (const [k, v] of Object.entries(punteggi)) c.caratteristiche[k as keyof typeof punteggi] = { valore: v, compTS: false };
    c.privilegi = [];
    c.incantesimi = [];
    return c;
  };

  it("slot di incantatori completi, mezzi, terzi e del patto", () => {
    expect(derivate(pg("Chierico", 1)).slotMax).toEqual([2]);
    expect(derivate(pg("Paladino", 1)).slotMax).toEqual([]);
    expect(derivate(pg("Paladino", 2)).slotMax).toEqual([2]);
    expect(derivate(pg("Ranger", 5)).slotMax).toEqual([4, 2]);
    expect(derivate(pg("Guerriero", 3, {}, "Campione")).slotMax).toEqual([]);
    expect(derivate(pg("Guerriero", 3, {}, "Cavaliere Mistico")).slotMax).toEqual([2]);
    expect(derivate(pg("Warlock", 1)).slotMax).toEqual([1]);
    expect(derivate(pg("Warlock", 3)).slotMax).toEqual([0, 2]);
    expect(slotPatto(11)).toEqual({ numero: 3, livelloSlot: 5 });
  });

  it("caratteristica da incantatore, CD e attacco magico dipendono dalla classe", () => {
    const chierico = derivate(pg("Chierico", 1, { SAG: 16, INT: 8 }));
    expect(chierico.caratteristicaMagica).toBe("SAG");
    expect(chierico.cdMagia).toBe(13);
    expect(chierico.attaccoMagico).toBe(5);
    const barbaro = derivate(pg("Barbaro", 1));
    expect(barbaro.caratteristicaMagica).toBeNull();
    expect(barbaro.cdMagia).toBeNull();
    expect(barbaro.haIncantesimi).toBe(false);
  });

  it("chi non incanta per classe usa la caratteristica della razza per i trucchetti razziali", () => {
    const c = pg("Guerriero", 1, { CAR: 14 });
    c.info.razza = "Tiefling";
    c.incantesimi = [{ id: 1, nome: "Taumaturgia", livello: 0, scuola: "Trasmutazione", tempo: "1 azione", preparato: true }];
    const d = derivate(c);
    expect(d.caratteristicaMagica).toBe("CAR");
    expect(d.incantatore).toBe(false);
    expect(d.haIncantesimi).toBe(true);
  });

  it("incantesimi preparati, del libro e conosciuti", () => {
    expect(derivate(pg("Paladino", 4, { CAR: 16 })).maxPreparabili).toBe(5); // metà livello + CAR
    expect(derivate(pg("Druido", 3, { SAG: 14 })).maxPreparabili).toBe(5);
    const stregone = derivate(pg("Stregone", 1));
    expect(stregone.maxPreparabili).toBeNull();
    expect(stregone.maxConosciuti).toBe(2);
    expect(stregone.maxTrucchetti).toBe(4);
    expect(stregone.prepara).toBe(false);
    expect(derivate(pg("Mago", 1)).modoIncantesimi).toBe("libro");
  });

  it("CA: armatura con limite di DES, scudo e Difesa Senza Armatura", () => {
    const barbaro = pg("Barbaro", 1, { DES: 14, COS: 16 });
    expect(derivate(barbaro)).toMatchObject({ ca: 15, notaCA: "Difesa Senza Armatura" });
    const monaco = pg("Monaco", 1, { DES: 16, SAG: 14 });
    expect(derivate(monaco).ca).toBe(15);
    expect(derivate({ ...monaco, scudo: true }).ca).toBe(15); // con lo scudo niente SAG: 10 + 3 + 2
    const cotta = { nome: "Cotta di Maglia", categoria: "pesante" as const, ca: 16, maxDes: 0, forzaMin: 13, svantaggioFurtivita: true, peso: 55 };
    const guerriero = { ...pg("Guerriero", 1, { DES: 14, FOR: 12 }), armatura: cotta, scudo: true };
    const d = derivate(guerriero);
    expect(d.ca).toBe(18);
    expect(d.avvisiArmatura).toHaveLength(2); // furtività e Forza sotto 13
    const pelle = { ...cotta, nome: "Armatura di Pelle", categoria: "media" as const, ca: 12, maxDes: 2, forzaMin: 0, svantaggioFurtivita: false };
    expect(derivate({ ...pg("Ranger", 1, { DES: 18 }), armatura: pelle }).ca).toBe(14);
  });

  it("Resilienza Draconica: CA 13 + DES e 1 PF in più per livello", () => {
    const c = pg("Stregone", 1, { DES: 14, COS: 12 }, "Discendenza Draconica");
    c.privilegi = [{ nome: "Resilienza Draconica", fonte: "Discendenza Draconica", descrizione: "" }];
    expect(derivate(c).ca).toBe(15);
    expect(pfPerLivello(c, 6)).toBe(6); // 4 + 1 (COS) + 1
  });

  it("PF per livello con il Dado Vita della classe", () => {
    expect(pfPerLivello(pg("Barbaro", 1, { COS: 14 }), 12)).toBe(9);
    const nano = pg("Guerriero", 1, { COS: 14 });
    nano.privilegi = [{ nome: "Robustezza Nanica", fonte: "Nano delle Colline", descrizione: "" }];
    expect(pfPerLivello(nano, 10)).toBe(9);
    expect(derivate(pg("Barbaro", 1)).dadoVita).toBe(12);
  });

  it("il riposo breve recupera gli slot del patto", () => {
    const warlock = { ...pg("Warlock", 3), slotSpesi: [0, 2, 0, 0, 0, 0, 0, 0, 0] };
    const dopo = riposoBreve(warlock, { dadiVitaSpesi: 0, pfRecuperati: 0, slotRecuperati: [] });
    expect(dopo.slotSpesi[1]).toBe(0);
    const mago = { ...pg("Mago", 3), slotSpesi: [0, 1, 0, 0, 0, 0, 0, 0, 0] };
    expect(riposoBreve(mago, { dadiVitaSpesi: 0, pfRecuperati: 0, slotRecuperati: [] }).slotSpesi[1]).toBe(1);
  });

  it("Presagio e Recupero Arcano solo per chi li ha", () => {
    expect(derivate(alston()).haPresagio).toBe(true);
    expect(derivate(pg("Mago", 3, {}, "Scuola di Invocazione")).haPresagio).toBe(false);
    expect(derivate(pg("Chierico", 3)).haRecuperoArcano).toBe(false);
    const c = pg("Guerriero", 1);
    expect(riposoLungo(c).divinazione).toEqual(c.divinazione); // senza Presagio non cambia
  });

  it("armi a distanza con la DES", () => {
    const c = pg("Ranger", 1, { FOR: 10, DES: 16 });
    const arco = { nome: "Arco Lungo", dado: "1d8", tipoDanno: "Perforante", proprieta: "", accurata: false, distanza: true };
    expect(derivate(c).attaccoArma(arco)).toEqual({ bonus: 5, mod: 3 });
  });

  it("salire di livello aggiunge i privilegi nuovi e la sottoclasse scelta", () => {
    const c = pg("Mago", 1, { COS: 14 });
    const presagio = { nome: "Presagio", fonte: "Scuola di Divinazione", descrizione: "..." };
    const dopo = saliDiLivello(c, { privilegi: [presagio, presagio], sottoclasse: "Scuola di Divinazione" });
    expect(dopo.info).toMatchObject({ livello: 2, sottoclasse: "Scuola di Divinazione" });
    expect(dopo.privilegi).toEqual([presagio]);
    expect(dopo.combattimento.pfMassimi).toBe(c.combattimento.pfMassimi + 6); // 3 + 1 + COS 2
  });
});
