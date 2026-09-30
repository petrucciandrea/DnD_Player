import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "./dati/alston";
import {
  bonusCompetenza, critico, dannoArma, derivate, formulaDanno, modificaCaratteristica, modificatore, parseDado, testoDanni, totaleDanni,
  riposoBreve, riposoLungo, risultatoD20, saliDiLivello,
  dannoIncantesimo, lanciaIncantesimo, numeroAttacchi, slotUtilizzabili,
  applicaCura, applicaDanno, cdConcentrazione, esitoTsMorte, statoVita, pfPerLivello, slotPatto,
  aggiungiCondizione, attivaEffetto, cambiaConteggioEffetto, impostaIndebolimento, privilegiMancanti, rimuoviEffetto, usaRisorsa,
  effettiAttivabili, usaPresagio, nuovaArma, statoArma, usaArma, riparaArma, rompiArma, ricaricaArma, recuperaMunizioni, usaMunizioni,
  danneggiaArma, dannoCritico, attacchiPerAzione, sogliaCritico, dadiCriticoBrutale, danniExtraArma,
  dadiAttaccoFurtivo, dannoPunizione, spendiSlot, armaDaMonaco, dadoArtiMarziali, COLPO_SENZA_ARMI,
  sceltePendenti, costoMetamagia, usaMetamagia, slotInPunti, puntiInSlot, incantesimiSottoclasseMancanti, aggiungiIncantesimi,
  applicaAumento, haAumentoCaratteristiche, incantesimiDaImparare, livelloMassimoIncantesimi,
} from "./regole";
import { effettoDaIncantesimo, suggerimentoTiro } from "./dati/condizioni";
import { competenteArmatura, competenzaCopreArma } from "./dati/competenze";
import { classeDellaLista, incantatoreDi, regoleClasse } from "./dati/classi";
import { completaConEsistente, daJSON } from "./scheda";
import { CLASSI_INCANTESIMI, SCHEDE_INCANTESIMI } from "../server/semi/incantesimi.ts";
import { TUTTE_LE_LISTE, incantesimiDiSottoclasse } from "./dati/incantesimiSottoclasse";
import type { CharacterData } from "./tipi";

const alston = (): CharacterData => structuredClone(INITIAL_CHARACTER);
const lancio = { daIncantesimo: true }; // effetto attivato dal lancio dell'incantesimo

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
    expect(d.attaccoArma(INITIAL_CHARACTER.armi[0])).toMatchObject({ bonus: 1, mod: -1 }); // bastone: FOR
    expect(d.attaccoArma(INITIAL_CHARACTER.armi[1])).toMatchObject({ bonus: 3, mod: 1 }); // pugnale: accurata
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
    c.competenzeAltre = { ...c.competenzeAltre, armi: [...regoleClasse(classe)!.armi], armature: [...regoleClasse(classe)!.armature] };
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
    expect(derivate(c).attaccoArma(arco)).toMatchObject({ bonus: 5, mod: 3, mischiaFOR: false });
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

describe("risorse di classe", () => {
  const pg = (classe: string, livello: number, punteggi: Partial<Record<"FOR" | "DES" | "COS" | "INT" | "SAG" | "CAR", number>> = {}, sottoclasse = "", razza = "Umano"): CharacterData => {
    const c = alston();
    c.info = { ...c.info, classe, livello, sottoclasse, razza };
    for (const [k, v] of Object.entries(punteggi)) c.caratteristiche[k as keyof typeof punteggi] = { valore: v, compTS: false };
    return c;
  };
  const risorsa = (c: CharacterData, id: string) => derivate(c).risorse.find(r => r.id === id);

  it("il massimo dipende da classe, livello e caratteristiche", () => {
    expect([1, 3, 6, 12, 17, 20].map(l => risorsa(pg("Barbaro", l), "ira")?.max)).toEqual([2, 3, 4, 5, 6, null]);
    expect(risorsa(pg("Monaco", 1), "punti-ki")).toBeUndefined();
    expect(risorsa(pg("Monaco", 7), "punti-ki")?.max).toBe(7);
    expect(risorsa(pg("Bardo", 3, { CAR: 16 }), "ispirazione-bardica")).toMatchObject({ max: 3, ricarica: "lunga", nota: "d6" });
    expect(risorsa(pg("Bardo", 5, { CAR: 8 }), "ispirazione-bardica")).toMatchObject({ max: 1, ricarica: "breve", nota: "d8" });
    expect(risorsa(pg("Paladino", 4), "imposizione-mani")?.max).toBe(20);
    expect(risorsa(pg("Chierico", 6), "incanalare-divinita")?.max).toBe(2);
    expect(risorsa(pg("Guerriero", 3, {}, "Maestro di Battaglia"), "dadi-superiorita")).toMatchObject({ max: 4, nota: "d8" });
    expect(risorsa(pg("Guerriero", 3, {}, "Campione"), "dadi-superiorita")).toBeUndefined();
    expect(risorsa(pg("Warlock", 11), "arcanum-6")?.max).toBe(1);
    expect(risorsa(pg("Warlock", 11), "arcanum-7")).toBeUndefined();
  });

  it("alcune risorse vengono dalla razza o dal dominio", () => {
    expect(risorsa(pg("Guerriero", 1, {}, "", "Dragonide"), "arma-a-soffio")).toBeDefined();
    expect(risorsa(pg("Guerriero", 1), "arma-a-soffio")).toBeUndefined();
    expect(risorsa(pg("Chierico", 1, { SAG: 16 }, "Dominio della Luce"), "bagliore-protettivo")?.max).toBe(3);
    expect(risorsa(pg("Chierico", 1, { SAG: 16 }, "Dominio della Vita"), "bagliore-protettivo")).toBeUndefined();
  });

  it("si spendono e si recuperano senza uscire dai limiti", () => {
    let c = pg("Monaco", 5);
    c = usaRisorsa(c, "punti-ki", 3);
    expect(risorsa(c, "punti-ki")).toMatchObject({ usati: 3, rimasti: 2 });
    expect(usaRisorsa(c, "punti-ki", 10).risorseUsate["punti-ki"]).toBe(5);
    expect(usaRisorsa(c, "punti-ki", -10).risorseUsate).toEqual({});
    expect(usaRisorsa(c, "non-esiste")).toBe(c);
    expect(usaRisorsa(pg("Barbaro", 20), "ira")).toEqual(pg("Barbaro", 20)); // illimitata
  });

  it("i riposi ricaricano le risorse giuste", () => {
    let c = pg("Guerriero", 9, {}, "Maestro di Battaglia");
    c = usaRisorsa(usaRisorsa(usaRisorsa(c, "recuperare-energie"), "indomito"), "dadi-superiorita", 2);
    const breve = riposoBreve(c, { dadiVitaSpesi: 0, pfRecuperati: 0, slotRecuperati: [] });
    expect(breve.risorseUsate).toEqual({ indomito: 1 }); // Indomito torna solo con il riposo lungo
    expect(riposoLungo(c).risorseUsate).toEqual({});
  });
});

describe("effetti attivi", () => {
  const barbaro = (livello = 3): CharacterData => {
    const c = alston();
    c.info = { ...c.info, classe: "Barbaro", livello, sottoclasse: "", razza: "Umano" };
    c.competenzeAltre = { ...c.competenzeAltre, armi: ["Armi semplici", "Armi da guerra"] };
    c.caratteristiche.FOR = { valore: 16, compTS: false };
    c.caratteristiche.DES = { valore: 12, compTS: false };
    c.armatura = null;
    c.scudo = false;
    c.concentrazione = "Tocco Gelido";
    return c;
  };
  const mago = () => {
    const c = alston();
    c.armatura = null;
    c.scudo = false;
    return c;
  };
  const spada = { nome: "Spada Lunga", dado: "1d8", tipoDanno: "Tagliente", proprieta: "", accurata: false };

  it("l'ira spende un uso, aggiunge danni in mischia con la Forza e interrompe la concentrazione", () => {
    const ira = attivaEffetto(barbaro(), "ira");
    expect(ira.effetti).toEqual([{ id: "ira" }]);
    expect(ira.risorseUsate.ira).toBe(1);
    expect(ira.concentrazione).toBeNull();
    expect(derivate(ira).attaccoArma(spada)).toMatchObject({ mod: 3, modDanno: 5, bonus: 5 });
    expect(derivate(barbaro()).attaccoArma(spada).modDanno).toBe(3);
    // Non vale per le armi a distanza.
    expect(derivate(ira).attaccoArma({ ...spada, distanza: true }).modDanno).toBe(derivate(ira).attaccoArma({ ...spada, distanza: true }).mod);
    expect(derivate(barbaro(9)).attaccoArma(spada).modDanno).toBe(3);
    expect(derivate(attivaEffetto(barbaro(9), "ira")).attaccoArma(spada).modDanno).toBe(6);
  });

  it("senza usi rimasti l'ira non si attiva, e chi non è barbaro non ce l'ha", () => {
    let c = barbaro(1);
    c = usaRisorsa(c, "ira", 2);
    expect(attivaEffetto(c, "ira")).toBe(c);
    expect(attivaEffetto(mago(), "ira")).toEqual(mago());
  });

  it("il riposo breve fa finire l'ira, quello lungo anche gli effetti di un'intera giornata", () => {
    let c = attivaEffetto(attivaEffetto(mago(), "armatura-magica"), "scudo", lancio);
    const breve = riposoBreve(c, { dadiVitaSpesi: 0, pfRecuperati: 0, slotRecuperati: [] });
    expect(breve.effetti.map(e => e.id)).toEqual(["armatura-magica"]);
    expect(riposoLungo(c).effetti).toEqual([]);
    c = rimuoviEffetto(c, "scudo");
    expect(c.effetti.map(e => e.id)).toEqual(["armatura-magica"]);
  });

  it("Armatura Magica, Scudo e Pelle Coriacea cambiano la CA", () => {
    const base = derivate(mago()); // DES 13 → CA 11
    expect(base.ca).toBe(11);
    const armatura = derivate(attivaEffetto(mago(), "armatura-magica"));
    expect(armatura.ca).toBe(14);
    expect(armatura.notaCA).toContain("Armatura Magica");
    expect(derivate(attivaEffetto(attivaEffetto(mago(), "armatura-magica"), "scudo", lancio)).ca).toBe(19);
    expect(derivate(attivaEffetto(mago(), "pelle-coriacea")).ca).toBe(16);
    // Con un'armatura indossata Armatura Magica non conta.
    const c = mago();
    c.armatura = { nome: "Cotta di Maglia", categoria: "pesante", ca: 16, maxDes: 0, forzaMin: 13, svantaggioFurtivita: true, peso: 55 };
    expect(derivate(attivaEffetto(c, "armatura-magica")).ca).toBe(16);
    expect(derivate(attivaEffetto(c, "scudo", lancio)).ca).toBe(21);
  });

  it("Immagine Speculare conta i duplicati e finisce a zero", () => {
    let c = attivaEffetto(mago(), "immagine-speculare", lancio);
    expect(c.effetti).toEqual([{ id: "immagine-speculare", valore: 3 }]);
    c = cambiaConteggioEffetto(c, "immagine-speculare", -1);
    expect(c.effetti[0].valore).toBe(2);
    expect(cambiaConteggioEffetto(c, "immagine-speculare", 5).effetti[0].valore).toBe(3);
    expect(cambiaConteggioEffetto(cambiaConteggioEffetto(c, "immagine-speculare", -1), "immagine-speculare", -1).effetti).toEqual([]);
  });

  it("un effetto non si attiva due volte e gli incantesimi li attivano per nome", () => {
    const c = attivaEffetto(mago(), "scudo", lancio);
    expect(attivaEffetto(c, "scudo", lancio)).toBe(c);
    expect(attivaEffetto(c, "inesistente")).toBe(c);
    expect(effettoDaIncantesimo(" scudo ")?.id).toBe("scudo");
    expect(effettoDaIncantesimo("Dardo di Fuoco")).toBeUndefined();
  });
});

describe("condizioni e indebolimento", () => {
  const c0 = () => alston();

  it("avvelenato dà svantaggio ad attacchi e prove ma non ai tiri salvezza", () => {
    const c = aggiungiCondizione(c0(), "avvelenato");
    expect(suggerimentoTiro(c, { tipo: "attacco" })).toMatchObject({ modalita: "svantaggio" });
    expect(suggerimentoTiro(c, { tipo: "prova", car: "SAG" }).modalita).toBe("svantaggio");
    expect(suggerimentoTiro(c, { tipo: "ts", car: "SAG" }).modalita).toBe("normale");
  });

  it("vantaggio e svantaggio si annullano", () => {
    let c = aggiungiCondizione(aggiungiCondizione(c0(), "avvelenato"), "invisibile");
    const s = suggerimentoTiro(c, { tipo: "attacco" });
    expect(s.modalita).toBe("normale");
    expect(s.note[0]).toContain("si annullano");
    c = aggiungiCondizione(c0(), "invisibile");
    expect(suggerimentoTiro(c, { tipo: "attacco" }).modalita).toBe("vantaggio");
  });

  it("paralizzato fallisce i TS di Forza e Destrezza, trattenuto ha svantaggio su Destrezza", () => {
    const p = aggiungiCondizione(c0(), "paralizzato");
    expect(suggerimentoTiro(p, { tipo: "ts", car: "DES" }).fallimentoAutomatico).toBe(true);
    expect(suggerimentoTiro(p, { tipo: "ts", car: "SAG" }).fallimentoAutomatico).toBe(false);
    const t = aggiungiCondizione(c0(), "trattenuto");
    expect(suggerimentoTiro(t, { tipo: "ts", car: "DES" }).modalita).toBe("svantaggio");
    expect(suggerimentoTiro(t, { tipo: "ts", car: "FOR" }).modalita).toBe("normale");
  });

  it("le condizioni che rendono incapaci interrompono la concentrazione", () => {
    const c = c0();
    c.concentrazione = "Tocco Gelido";
    expect(aggiungiCondizione(c, "prono").concentrazione).toBe("Tocco Gelido");
    expect(aggiungiCondizione(c, "stordito").concentrazione).toBeNull();
    expect(aggiungiCondizione(c, "inesistente")).toBe(c);
  });

  it("l'ira dà vantaggio a prove e TS di Forza, l'attacco sconsiderato solo agli attacchi in mischia con la Forza", () => {
    const c = alston();
    c.info.classe = "Barbaro";
    c.info.livello = 3;
    const ira = attivaEffetto(c, "ira");
    expect(suggerimentoTiro(ira, { tipo: "prova", car: "FOR" }).modalita).toBe("vantaggio");
    expect(suggerimentoTiro(ira, { tipo: "ts", car: "FOR" }).modalita).toBe("vantaggio");
    expect(suggerimentoTiro(ira, { tipo: "ts", car: "DES" }).modalita).toBe("normale");
    const sconsiderato = attivaEffetto(c, "attacco-sconsiderato");
    expect(suggerimentoTiro(sconsiderato, { tipo: "attacco", mischiaFOR: true }).modalita).toBe("vantaggio");
    expect(suggerimentoTiro(sconsiderato, { tipo: "attacco", mischiaFOR: false }).modalita).toBe("normale");
  });

  it("l'indebolimento ha effetti crescenti", () => {
    let c = impostaIndebolimento(c0(), 1);
    expect(suggerimentoTiro(c, { tipo: "prova" }).modalita).toBe("svantaggio");
    expect(suggerimentoTiro(c, { tipo: "attacco" }).modalita).toBe("normale");
    c = impostaIndebolimento(c, 3);
    expect(suggerimentoTiro(c, { tipo: "attacco" }).modalita).toBe("svantaggio");
    expect(suggerimentoTiro(c, { tipo: "ts", car: "COS" }).modalita).toBe("svantaggio");
  });

  it("a 4 livelli i PF massimi si dimezzano: limite per la cura e per i PF attuali", () => {
    const c = c0();
    c.combattimento.pfMassimi = 20;
    c.combattimento.pfAttuali = 18;
    const stanco = impostaIndebolimento(c, 4);
    expect(derivate(stanco).pfMassimiEffettivi).toBe(10);
    expect(stanco.combattimento.pfAttuali).toBe(10);
    expect(applicaCura({ ...stanco, combattimento: { ...stanco.combattimento, pfAttuali: 5 } }, 50).combattimento.pfAttuali).toBe(10);
    expect(impostaIndebolimento(c, 99).indebolimento).toBe(6);
    expect(impostaIndebolimento(c, -2).indebolimento).toBe(0);
  });

  it("il riposo lungo toglie un livello di indebolimento e cura fino ai PF massimi effettivi", () => {
    const c = c0();
    c.combattimento.pfMassimi = 20;
    c.combattimento.pfAttuali = 3;
    const riposato = riposoLungo(impostaIndebolimento(c, 5));
    expect(riposato.indebolimento).toBe(4);
    expect(riposato.combattimento.pfAttuali).toBe(10);
    const dopo = riposoLungo(riposato);
    expect(dopo.indebolimento).toBe(3);
    expect(dopo.combattimento.pfAttuali).toBe(20);
  });

  it("condizioni, effetti e risorse sopravvivono alla normalizzazione", () => {
    const c = c0();
    c.condizioni = ["prono"];
    c.indebolimento = 2;
    c.effetti = [{ id: "immagine-speculare", valore: 2 }];
    c.risorseUsate = { "punti-ki": 2 };
    expect(daJSON(JSON.parse(JSON.stringify(c)))).toEqual(c);
    const sporca = daJSON({ ...c, indebolimento: 99, condizioni: ["prono", "prono", 3], effetti: [{ id: "scudo" }, { id: "scudo" }, "x"], risorseUsate: { a: -1, b: 2.7, c: "x" } });
    expect(sporca).toMatchObject({ indebolimento: 6, condizioni: ["prono"], effetti: [{ id: "scudo" }], risorseUsate: { b: 2 } });
  });
});

describe("privilegi mancanti", () => {
  const catalogo = [
    { classe: "Mago", sottoclasse: null, livello: 1, privilegio: { nome: "Recupero Arcano", fonte: "Mago", descrizione: "x" } },
    { classe: "Mago", sottoclasse: null, livello: 2, privilegio: { nome: "Tradizione Arcana", fonte: "Mago", descrizione: "x" } },
    { classe: "Mago", sottoclasse: "Scuola di Divinazione", livello: 6, privilegio: { nome: "Divinazione Esperta", fonte: "Scuola di Divinazione", descrizione: "x" } },
    { classe: "Mago", sottoclasse: "Scuola di Invocazione", livello: 2, privilegio: { nome: "Scolpire Incantesimi", fonte: "Scuola di Invocazione", descrizione: "x" } },
    { classe: "Mago", sottoclasse: null, livello: 18, privilegio: { nome: "Maestria negli Incantesimi", fonte: "Mago", descrizione: "x" } },
    { classe: "Bardo", sottoclasse: null, livello: 2, privilegio: { nome: "Factotum", fonte: "Bardo", descrizione: "x" } },
  ];

  it("restituisce solo quelli di classe e sottoclasse fino al livello attuale che la scheda non ha", () => {
    const c = alston(); // Mago 3, Divinazione
    expect(privilegiMancanti(c, catalogo).map(p => p.nome)).toEqual(["Tradizione Arcana"]);
    c.info.livello = 6;
    expect(privilegiMancanti(c, catalogo).map(p => p.nome)).toEqual(["Tradizione Arcana", "Divinazione Esperta"]);
  });

  it("non ripropone quelli già presenti, anche con maiuscole diverse", () => {
    const c = alston();
    c.privilegi.push({ nome: "tradizione arcana", fonte: "MAGO", descrizione: "" });
    expect(privilegiMancanti(c, catalogo)).toEqual([]);
  });
});

describe("effetti attivabili dal pannello", () => {
  const barbaro = (livello: number): CharacterData => {
    const c = alston();
    c.info = { ...c.info, classe: "Barbaro", livello, sottoclasse: "" };
    return c;
  };
  const ids = (c: CharacterData) => {
    const { privilegi, daAlleato } = effettiAttivabili(c);
    return { privilegi: privilegi.map(e => e.id), daAlleato: daAlleato.map(e => e.id) };
  };

  it("gli incantesimi solo personali partono solo dal lancio", () => {
    const c = alston();
    expect(attivaEffetto(c, "scudo")).toBe(c);
    expect(attivaEffetto(c, "immagine-speculare")).toBe(c);
    expect(attivaEffetto(c, "immagine-speculare", lancio).effetti).toEqual([{ id: "immagine-speculare", valore: 3 }]);
    expect(ids(c).daAlleato).not.toContain("scudo");
    expect(ids(c).daAlleato).not.toContain("immagine-speculare");
  });

  it("quelli che può lanciare un alleato si segnano dal pannello", () => {
    const c = alston();
    expect(ids(c).daAlleato).toEqual(["armatura-magica", "scudo-della-fede", "pelle-coriacea", "velocita", "benedizione"]);
    expect(attivaEffetto(c, "benedizione").effetti).toEqual([{ id: "benedizione" }]);
    // Già attivo: non si offre più.
    expect(ids(attivaEffetto(c, "benedizione")).daAlleato).not.toContain("benedizione");
  });

  it("i privilegi solo alla classe e dal livello giusti, con un uso libero", () => {
    expect(ids(alston()).privilegi).toEqual([]);
    expect(attivaEffetto(alston(), "ira")).toEqual(alston());
    expect(ids(barbaro(1)).privilegi).toEqual(["ira"]);
    expect(attivaEffetto(barbaro(1), "attacco-sconsiderato").effetti).toEqual([]);
    expect(ids(barbaro(2)).privilegi).toEqual(["ira", "attacco-sconsiderato"]);
    expect(attivaEffetto(barbaro(2), "attacco-sconsiderato").effetti).toEqual([{ id: "attacco-sconsiderato" }]);
    expect(ids(usaRisorsa(barbaro(1), "ira", 2)).privilegi).toEqual([]);
    // Nemmeno il lancio aggira i limiti di un privilegio.
    expect(attivaEffetto(alston(), "ira", lancio).effetti).toEqual([]);
  });
});

describe("Presagio", () => {
  it("offre i dadi non usati e li segna quando sostituiscono un tiro", () => {
    const c = alston();
    c.divinazione = { presagio: [4, 17], usati: [false, false] };
    expect(derivate(c).presagioDisponibile).toEqual([{ indice: 0, valore: 4 }, { indice: 1, valore: 17 }]);
    const usato = usaPresagio(c, 1);
    expect(usato.divinazione).toEqual({ presagio: [4, 17], usati: [false, true] });
    expect(derivate(usato).presagioDisponibile).toEqual([{ indice: 0, valore: 4 }]);
    expect(usaPresagio(usato, 1)).toBe(usato);
    expect(usaPresagio(c, 5)).toBe(c);
  });

  it("solo per la Scuola di Divinazione", () => {
    const c = alston();
    c.info.sottoclasse = "Scuola di Invocazione";
    c.divinazione = { presagio: [4, 17], usati: [false, false] };
    expect(derivate(c).presagioDisponibile).toEqual([]);
  });
});

describe("armi del personaggio", () => {
  const arco = { nome: "Arco Corto", dado: "1d6", tipoDanno: "Perforante", proprieta: "Munizioni (24/96 m), Due mani", accurata: false, distanza: true };
  const conArma = (modifiche: Partial<ReturnType<typeof nuovaArma>>): CharacterData => {
    const c = alston();
    c.armi = [{ ...nuovaArma(arco, 9), ...modifiche }];
    return c;
  };

  it("le munizioni scendono a ogni attacco e a 0 non si attacca", () => {
    expect(usaMunizioni(arco)).toBe(true);
    let c = conArma({ munizioni: { rimasti: 2, massimo: 20 } });
    c = usaArma(c, 9);
    expect(c.armi[0].munizioni).toEqual({ rimasti: 1, massimo: 20 });
    c = usaArma(c, 9);
    expect(statoArma(c.armi[0])).toEqual({ utilizzabile: false, motivo: "Munizioni esaurite." });
    expect(usaArma(c, 9)).toBe(c);
    expect(c.armi[0].rotta).toBe(false);
  });

  it("recuperare dà metà delle munizioni spese, ricaricare resta nel massimo", () => {
    const c = conArma({ munizioni: { rimasti: 5, massimo: 20 } });
    expect(recuperaMunizioni(c, 9).armi[0].munizioni?.rimasti).toBe(12);
    expect(ricaricaArma(c, 9, 100).armi[0].munizioni?.rimasti).toBe(20);
    expect(ricaricaArma(c, 9, -100).armi[0].munizioni?.rimasti).toBe(0);
    expect(recuperaMunizioni(conArma({}), 9).armi[0].munizioni).toBeNull();
  });

  it("a durabilità 0 l'arma si rompe; riparata torna al massimo", () => {
    let c = conArma({ durabilita: { rimasti: 1, massimo: 5 } });
    c = usaArma(c, 9);
    expect(c.armi[0]).toMatchObject({ rotta: true, durabilita: { rimasti: 0, massimo: 5 } });
    expect(statoArma(c.armi[0]).utilizzabile).toBe(false);
    c = riparaArma(c, 9);
    expect(c.armi[0]).toMatchObject({ rotta: false, durabilita: { rimasti: 5, massimo: 5 } });
  });

  it("un'arma senza contatori si può rompere e riparare a mano", () => {
    const c = conArma({});
    expect(usaArma(c, 9)).toBe(c);
    const rotta = rompiArma(c, 9);
    expect(statoArma(rotta.armi[0]).utilizzabile).toBe(false);
    expect(riparaArma(rotta, 9).armi[0]).toEqual(c.armi[0]);
    expect(usaArma(c, 123)).toBe(c);
  });

  it("un'arma senza durabilità danneggiata regge i colpi indicati, poi riparata torna intatta", () => {
    let c = danneggiaArma(conArma({}), 9, 2);
    expect(c.armi[0]).toMatchObject({ danneggiata: 2, durabilita: null, rotta: false });
    // Danneggiarla di nuovo non le ridà colpi.
    expect(danneggiaArma(c, 9, 5)).toBe(c);
    c = usaArma(c, 9);
    expect(c.armi[0]).toMatchObject({ danneggiata: 1, rotta: false });
    c = usaArma(c, 9);
    expect(c.armi[0]).toMatchObject({ danneggiata: 0, rotta: true });
    expect(usaArma(c, 9)).toBe(c);
    c = riparaArma(c, 9);
    expect(c.armi[0]).toMatchObject({ danneggiata: null, rotta: false });
    expect(usaArma(c, 9)).toBe(c); // di nuovo senza limite di colpi
  });

  it("danneggiare un'arma con durabilità ne abbassa i punti rimasti; con 0 colpi si rompe", () => {
    const c = conArma({ durabilita: { rimasti: 8, massimo: 10 } });
    expect(danneggiaArma(c, 9, 3).armi[0]).toMatchObject({ durabilita: { rimasti: 3, massimo: 10 }, danneggiata: null });
    expect(danneggiaArma(c, 9, 9)).toBe(c);
    expect(danneggiaArma(conArma({}), 9, 0).armi[0].rotta).toBe(true);
    expect(riparaArma(danneggiaArma(c, 9, 3), 9).armi[0].durabilita).toEqual({ rimasti: 10, massimo: 10 });
  });

  it("il bonus magico vale per attacco e danni", () => {
    const c = alston(); // DES 13, competenza +2
    c.competenzeAltre.armi.push("Archi corti");
    const d = derivate(c);
    expect(d.attaccoArma({ ...nuovaArma(arco, 1), bonus: 2 })).toMatchObject({ bonus: 5, modDanno: 3 });
    expect(d.attaccoArma(arco)).toMatchObject({ bonus: 3, modDanno: 1 });
  });
});

describe("salvataggio: armi, avatar e campi delle note", () => {
  it("completa le vecchie armi e scarta i contatori non validi", () => {
    const c = alston() as unknown as Record<string, unknown>;
    c.armi = [
      { nome: "Pugnale", dado: "1d4", tipoDanno: "Perforante", proprieta: "", accurata: true },
      { nome: "Pugnale", dado: "1d4", tipoDanno: "Perforante", proprieta: "", accurata: true, id: 1, munizioni: { rimasti: 50, massimo: 5 }, durabilita: { massimo: 0 } },
    ];
    const [primo, secondo] = daJSON(c).armi;
    expect(primo).toMatchObject({ id: 1, bonus: 0, munizioni: null, durabilita: null, danneggiata: null, rotta: false });
    expect(secondo).toMatchObject({ id: 2, munizioni: { rimasti: 5, massimo: 5 }, durabilita: null });
  });

  it("accetta come avatar solo un'immagine in data URL", () => {
    const c = alston();
    expect(daJSON({ ...c, info: { ...c.info, avatar: "data:image/jpeg;base64,AAAA" } }).info.avatar).toBe("data:image/jpeg;base64,AAAA");
    expect(daJSON({ ...c, info: { ...c.info, avatar: "javascript:alert(1)" } }).info.avatar).toBe("");
    expect(daJSON({ ...c, info: { ...c.info, avatar: `data:image/png;base64,${"A".repeat(400_000)}` } }).info.avatar).toBe("");
    const senza: Record<string, unknown> = { ...c.info };
    delete senza.avatar;
    expect(daJSON({ ...c, info: senza }).info.avatar).toBe("");
  });

  it("i campi delle note tengono solo testi", () => {
    const c = alston();
    const nota = { id: 1, data: "", categoria: "png", titolo: "Oste", testo: "", fatto: false, campi: { razza: "Nano", eta: 40 } };
    expect(daJSON({ ...c, note: [nota] }).note[0].campi).toEqual({ razza: "Nano" });
    expect(daJSON({ ...c, note: [{ ...nota, campi: undefined }] }).note[0].campi).toEqual({});
  });
});


describe("competenze in armi e armature", () => {
  const cotta = { nome: "Cotta di Maglia", categoria: "pesante" as const, ca: 16, maxDes: 0, forzaMin: 13, svantaggioFurtivita: true, peso: 55 };

  it("categorie, nomi al plurale e al singolare", () => {
    expect(competenzaCopreArma("Armi semplici", { nome: "Pugnale", categoria: "semplice" })).toBe(true);
    expect(competenzaCopreArma("Armi semplici", { nome: "Stocco", categoria: "guerra" })).toBe(false);
    expect(competenzaCopreArma("Armi da guerra", { nome: "Stocco", categoria: "guerra" })).toBe(true);
    expect(competenzaCopreArma("Pugnali", { nome: "Pugnale", categoria: "semplice" })).toBe(true);
    expect(competenzaCopreArma("balestre leggere", { nome: "Balestra Leggera", categoria: "semplice" })).toBe(true);
    expect(competenzaCopreArma("Spade lunghe", { nome: "Spada Corta", categoria: "guerra" })).toBe(false);
    expect(competenzaCopreArma("Spada lunga", { nome: "Spada Lunga", categoria: "guerra" })).toBe(true);
  });

  it("senza competenza nell'arma non si aggiunge il bonus di competenza", () => {
    const d = derivate(alston());
    const spadone = { nome: "Spadone", dado: "2d6", tipoDanno: "Tagliente", proprieta: "Pesante, Due mani", accurata: false, categoria: "guerra" as const };
    expect(d.attaccoArma(spadone)).toMatchObject({ bonus: -1, competente: false, car: "FOR" });
    expect(d.attaccoArma(INITIAL_CHARACTER.armi[1])).toMatchObject({ bonus: 3, competente: true, car: "DES" });
  });

  it("armatura senza competenza: svantaggio con FOR e DES e niente incantesimi", () => {
    const c = { ...alston(), armatura: cotta };
    expect(competenteArmatura(c)).toBe(false);
    const d = derivate(c);
    expect(d.armaturaCompetente).toBe(false);
    expect(d.incantesimiBloccati).not.toBeNull();
    expect(suggerimentoTiro(c, { tipo: "ts", car: "DES" }).modalita).toBe("svantaggio");
    expect(suggerimentoTiro(c, { tipo: "attacco", car: "FOR" }).modalita).toBe("svantaggio");
    expect(suggerimentoTiro(c, { tipo: "ts", car: "INT" }).modalita).toBe("normale");
    const guerriero = { ...c, competenzeAltre: { ...c.competenzeAltre, armature: ["Tutte le armature", "Scudi"] }, scudo: true };
    expect(competenteArmatura(guerriero)).toBe(true);
    expect(derivate(guerriero).incantesimiBloccati).toBeNull();
    expect(competenteArmatura({ ...alston(), scudo: true })).toBe(false);
  });

  it("i vecchi salvataggi senza competenze in armi e armature prendono quelle della classe", () => {
    const c = alston();
    const vecchio = { ...c, competenzeAltre: { ...c.competenzeAltre, armi: [], armature: [] } };
    expect(daJSON(vecchio).competenzeAltre.armi).toEqual(["Balestre leggere", "Bastoni ferrati", "Dardi", "Fionde", "Pugnali"]);
    expect(daJSON({ ...vecchio, info: { ...c.info, classe: "Guerriero" } }).competenzeAltre.armature).toEqual(["Tutte le armature", "Scudi"]);
    // Con almeno una competenza la scheda resta com'è.
    expect(daJSON({ ...vecchio, competenzeAltre: { ...vecchio.competenzeAltre, armi: ["Pugnali"] } }).competenzeAltre.armi).toEqual(["Pugnali"]);
  });
});

describe("privilegi che cambiano attacchi e danni", () => {
  const pg = (classe: string, livello: number, sottoclasse = "", punteggi: Partial<Record<"FOR" | "DES" | "CAR", number>> = {}): CharacterData => {
    const c = alston();
    c.info = { ...c.info, classe, livello, sottoclasse };
    for (const [k, v] of Object.entries(punteggi)) c.caratteristiche[k as keyof typeof punteggi] = { valore: v, compTS: false };
    c.competenzeAltre = { ...c.competenzeAltre, armi: [...regoleClasse(classe)!.armi], armature: [...regoleClasse(classe)!.armature] };
    c.armatura = null;
    c.scudo = false;
    return c;
  };
  const stocco = { nome: "Stocco", dado: "1d8", tipoDanno: "Perforante", proprieta: "Accurata", accurata: true, categoria: "guerra" as const };
  const spada = { nome: "Spada Lunga", dado: "1d8", dadoVersatile: "1d10", tipoDanno: "Tagliente", proprieta: "Versatile", accurata: false, categoria: "guerra" as const };
  const bastone = { nome: "Bastone Ferrato", dado: "1d6", dadoVersatile: "1d8", tipoDanno: "Contundente", proprieta: "Versatile", accurata: false, categoria: "semplice" as const };

  it("danni in più parti: testo, critico e Critico Brutale", () => {
    const parti = [{ numero: 1, facce: 8, mod: 3, tipo: "taglienti" }, { numero: 2, facce: 6, mod: 0, tipo: "taglienti", etichetta: "Attacco Furtivo" }];
    expect(testoDanni(parti)).toBe("1d8 + 3 + 2d6");
    expect(dannoCritico(parti).map(p => p.numero)).toEqual([2, 4]);
    expect(dannoCritico(parti, 2).map(p => p.numero)).toEqual([4, 4]);
    expect(testoDanni({ numero: 0, facce: 1, mod: 2, tipo: "contundenti" })).toBe("2");
  });

  it("Attacco Extra, Critico Migliorato e Critico Brutale per classe e livello", () => {
    expect([4, 5, 11, 20].map(l => attacchiPerAzione(pg("Guerriero", l)))).toEqual([1, 2, 3, 4]);
    expect(attacchiPerAzione(pg("Ranger", 5))).toBe(2);
    expect(attacchiPerAzione(pg("Mago", 20))).toBe(1);
    expect(attacchiPerAzione(pg("Bardo", 6, "Collegio del Valore"))).toBe(2);
    expect(attacchiPerAzione(pg("Bardo", 6, "Collegio della Sapienza"))).toBe(1);
    expect([sogliaCritico(pg("Guerriero", 3, "Campione")), sogliaCritico(pg("Guerriero", 15, "Campione")), sogliaCritico(pg("Guerriero", 15, "Maestro di Battaglia"))])
      .toEqual([19, 18, 20]);
    expect([8, 9, 13, 17].map(l => dadiCriticoBrutale(pg("Barbaro", l)))).toEqual([0, 1, 2, 3]);
  });

  it("Attacco Furtivo solo con armi accurate o a distanza", () => {
    const ladro = pg("Ladro", 5);
    expect(danniExtraArma(ladro, stocco)).toMatchObject([{ id: "attacco-furtivo", facoltativa: true, danni: { numero: 3, facce: 6, tipo: "perforanti" } }]);
    expect(danniExtraArma(ladro, spada)).toEqual([]);
    expect(dadiAttaccoFurtivo(1)).toBe(1);
  });

  it("Punizione Divina: dadi per slot, immondi, slot necessario e versione migliorata", () => {
    expect([1, 2, 4, 5].map(l => dannoPunizione(l).numero)).toEqual([2, 3, 5, 5]);
    expect(dannoPunizione(4, true).numero).toBe(6);
    const paladino = pg("Paladino", 2);
    expect(danniExtraArma(paladino, spada).map(e => e.id)).toEqual(["punizione-divina"]);
    expect(danniExtraArma({ ...paladino, slotSpesi: [2, 0, 0, 0, 0, 0, 0, 0, 0] }, spada)).toEqual([]); // niente slot liberi
    expect(danniExtraArma(paladino, { ...spada, distanza: true })).toEqual([]);
    expect(danniExtraArma(pg("Paladino", 11), spada).map(e => e.id)).toEqual(["punizione-divina", "punizione-migliorata"]);
    expect(spendiSlot(paladino, 1).slotSpesi[0]).toBe(1);
    expect(spendiSlot(paladino, 3)).toBe(paladino);
  });

  it("Arti Marziali: DES e dado del monaco con le armi da monaco, senza armatura né scudo", () => {
    const monaco = pg("Monaco", 5, "", { FOR: 10, DES: 16 });
    const d = derivate(monaco);
    expect(d.artiMarziali).toBe(true);
    expect(d.attaccoArma(bastone)).toMatchObject({ car: "DES", danni: { numero: 1, facce: 6, mod: 3 }, danniDueMani: { facce: 8 } });
    expect(d.attaccoArma(COLPO_SENZA_ARMI)).toMatchObject({ competente: true, danni: { numero: 1, facce: 6, mod: 3 } });
    expect(armaDaMonaco(spada)).toBe(false);
    expect(armaDaMonaco({ ...bastone, nome: "Randello Pesante", proprieta: "Due mani" })).toBe(false);
    expect(derivate({ ...monaco, scudo: true }).attaccoArma(bastone)).toMatchObject({ car: "FOR" });
    expect(dadoArtiMarziali(17)).toBe(10);
  });

  it("il colpo senz'armi di chi non è monaco fa 1 + FOR", () => {
    const d = derivate(pg("Guerriero", 1, "", { FOR: 16 }));
    expect(d.attaccoArma(COLPO_SENZA_ARMI)).toMatchObject({ bonus: 5, danni: { numero: 0, mod: 4 } });
  });
});

describe("scelte di privilegio: Metamagia, Fonte di Magia, stili di combattimento", () => {
  const pg = (classe: string, livello: number, sottoclasse = ""): CharacterData => {
    const c = alston();
    c.info = { ...c.info, classe, livello, sottoclasse };
    c.privilegi = [];
    c.competenzeAltre = { ...c.competenzeAltre, armi: [...regoleClasse(classe)!.armi], armature: [...regoleClasse(classe)!.armature] };
    return c;
  };
  const stile = (nome: string) => ({ nome, fonte: "Stile di Combattimento", descrizione: "" });
  const metamagiaP = (nome: string) => ({ nome, fonte: "Metamagia", descrizione: "" });

  it("scelte dovute per classe, sottoclasse e livello", () => {
    expect(sceltePendenti(pg("Stregone", 2))).toEqual([]);
    expect(sceltePendenti(pg("Stregone", 3)).map(x => [x.scelta.id, x.mancano])).toEqual([["metamagia", 2]]);
    const stregone = { ...pg("Stregone", 10), privilegi: [metamagiaP("Incantesimo Rapido"), metamagiaP("Incantesimo Gemello")] };
    expect(sceltePendenti(stregone).map(x => x.mancano)).toEqual([1]);
    expect(sceltePendenti(pg("Guerriero", 1)).map(x => x.scelta.id)).toEqual(["stile-guerriero"]);
    const campione = { ...pg("Guerriero", 9, "Campione"), privilegi: [stile("Difesa")] };
    expect(sceltePendenti(campione)).toEqual([]);
    expect(sceltePendenti(campione, { livello: 10 }).map(x => [x.scelta.id, x.mancano])).toEqual([["stile-campione", 1]]);
    // Un Ranger conta solo gli stili ammessi per lui.
    expect(sceltePendenti({ ...pg("Ranger", 2), privilegi: [stile("Protezione")] }).map(x => x.mancano)).toEqual([1]);
    expect(sceltePendenti(pg("Druido", 3, "Circolo della Terra")).map(x => x.scelta.id)).toEqual(["terreno"]);
    expect(sceltePendenti(pg("Druido", 3, "Circolo della Luna"))).toEqual([]);
  });

  it("costo della Metamagia e spesa dei punti stregoneria", () => {
    expect(costoMetamagia(["Incantesimo Gemello"], 0)).toBe(1);
    expect(costoMetamagia(["Incantesimo Gemello", "Incantesimo Rapido"], 3)).toBe(5);
    expect(costoMetamagia(["Incantesimo Intensificato"], 1)).toBe(3);
    const c = pg("Stregone", 3);
    expect(usaMetamagia(c, ["Incantesimo Rapido"], 1).risorseUsate["punti-stregoneria"]).toBe(2);
    expect(usaMetamagia(c, ["Incantesimo Intensificato", "Incantesimo Rapido"], 1)).toBe(c); // servono 5 punti, ne ha 3
  });

  it("Fonte di Magia: slot in punti e punti in slot", () => {
    const c = { ...pg("Stregone", 5), risorseUsate: { "punti-stregoneria": 3 } };
    const convertito = slotInPunti(c, 2);
    expect(convertito.slotSpesi[1]).toBe(1);
    expect(convertito.risorseUsate["punti-stregoneria"]).toBe(1);
    expect(slotInPunti({ ...c, risorseUsate: {} }, 2)).toEqual({ ...c, risorseUsate: {} }); // i punti sono già al massimo
    const speso = { ...c, risorseUsate: {}, slotSpesi: [0, 1, 0, 0, 0, 0, 0, 0, 0] };
    const creato = puntiInSlot(speso, 2);
    expect(creato.slotSpesi[1]).toBe(0);
    expect(creato.risorseUsate["punti-stregoneria"]).toBe(3);
    expect(puntiInSlot({ ...speso, slotSpesi: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, 2).slotSpesi[1]).toBe(0); // nessuno slot speso: non cambia
    expect(puntiInSlot(speso, 6)).toBe(speso);
    expect(slotInPunti(pg("Mago", 5), 1)).toEqual(pg("Mago", 5)); // senza punti stregoneria
  });

  it("stili: Difesa con armatura, Tiro a distanza, Duellare in mischia a una mano", () => {
    const cotta = { nome: "Cotta di Maglia", categoria: "pesante" as const, ca: 16, maxDes: 0, forzaMin: 13, svantaggioFurtivita: true, peso: 55 };
    const g = { ...pg("Guerriero", 1), armatura: cotta, scudo: false };
    expect(derivate({ ...g, privilegi: [stile("Difesa")] }).ca).toBe(derivate(g).ca + 1);
    expect(derivate({ ...g, armatura: null, privilegi: [stile("Difesa")] }).ca).toBe(derivate({ ...g, armatura: null }).ca);
    const arco = { nome: "Arco Lungo", dado: "1d8", tipoDanno: "Perforante", proprieta: "Munizioni, Pesante, Due mani", accurata: false, distanza: true, categoria: "guerra" as const };
    const spada = { nome: "Spada Lunga", dado: "1d8", dadoVersatile: "1d10", tipoDanno: "Tagliente", proprieta: "Versatile", accurata: false, categoria: "guerra" as const };
    const spadone = { nome: "Spadone", dado: "2d6", tipoDanno: "Tagliente", proprieta: "Pesante, Due mani", accurata: false, categoria: "guerra" as const };
    expect(derivate({ ...g, privilegi: [stile("Tiro")] }).attaccoArma(arco).bonus).toBe(derivate(g).attaccoArma(arco).bonus + 2);
    const duellante = derivate({ ...g, privilegi: [stile("Duellare")] });
    expect(duellante.attaccoArma(spada).danni.mod).toBe(derivate(g).attaccoArma(spada).danni.mod + 2);
    expect(duellante.attaccoArma(spada).danniDueMani?.mod).toBe(derivate(g).attaccoArma(spada).danniDueMani?.mod);
    expect(duellante.attaccoArma(spadone).danni.mod).toBe(derivate(g).attaccoArma(spadone).danni.mod);
    expect(derivate({ ...g, privilegi: [stile("Combattere con Armi Possenti")] }).attaccoArma(spadone).note[0]).toMatch(/ritira/);
  });
});

describe("incantesimi di dominio, giuramento, circolo e patrono", () => {
  const pg = (classe: string, livello: number, sottoclasse: string): CharacterData => {
    const c = alston();
    c.info = { ...c.info, classe, livello, sottoclasse };
    c.privilegi = [];
    c.incantesimi = [];
    return c;
  };
  const spell = (nome: string, livello = 1, preparato = false) => ({ id: nome.length, nome, livello, scuola: "Invocazione", tempo: "1 azione", preparato });

  it("il catalogo ha una scheda valida per ogni incantesimo delle liste", () => {
    const nomi = new Set(TUTTE_LE_LISTE.flatMap(l => l.flatMap(([, n]) => n)));
    expect([...nomi].filter(n => !SCHEDE_INCANTESIMI[n])).toEqual([]);
    for (const [nome, s] of Object.entries(SCHEDE_INCANTESIMI)) {
      expect(CLASSI_INCANTESIMI[nome]?.length, nome).toBeGreaterThan(0);
      if (s.danni) expect(() => parseDado(s.danni!.dado), nome).not.toThrow();
      if (s.danni?.perLivello) expect(() => parseDado(s.danni!.perLivello!), nome).not.toThrow();
    }
  });

  it("domini e giuramenti per livello, terreni dal privilegio scelto, patroni come lista ampliata", () => {
    expect(incantesimiDiSottoclasse(pg("Chierico", 1, "Dominio della Vita"))).toEqual({ sempre: ["Benedizione", "Cura Ferite"], ampliata: [], fonte: "Dominio" });
    expect(incantesimiDiSottoclasse(pg("Chierico", 3, "Dominio della Vita")).sempre).toHaveLength(4);
    expect(incantesimiDiSottoclasse(pg("Paladino", 2, "Giuramento di Vendetta")).sempre).toEqual([]);
    expect(incantesimiDiSottoclasse(pg("Paladino", 5, "Giuramento di Vendetta")).sempre).toEqual(["Anatema", "Marchio del Cacciatore", "Blocca Persone", "Passo Velato"]);
    const druido = pg("Druido", 5, "Circolo della Terra");
    expect(incantesimiDiSottoclasse(druido).sempre).toEqual([]); // terreno non ancora scelto
    druido.privilegi = [{ nome: "Montagna", fonte: "Terreno del Circolo", descrizione: "" }];
    expect(incantesimiDiSottoclasse(druido).sempre).toEqual(["Movimenti del Ragno", "Crescita di Spine", "Fulmine", "Fondersi nella Pietra"]);
    expect(incantesimiDiSottoclasse(pg("Warlock", 3, "L'Immondo"))).toMatchObject({ sempre: [], ampliata: ["Mani Brucianti", "Comando", "Cecità/Sordità", "Raggio Rovente"] });
    expect(incantesimiDiSottoclasse(pg("Mago", 5, "Scuola di Divinazione")).fonte).toBeNull();
  });

  it("sempre preparati e fuori dal limite; i mancanti si aggiungono preparati senza doppioni", () => {
    const c = { ...pg("Chierico", 1, "Dominio della Vita"), incantesimi: [spell("Benedizione", 1, true), spell("Santuario", 1, true)] };
    const d = derivate(c);
    expect(d.preparatiAttuali).toBe(1);
    expect(d.semprePreparato("benedizione ")).toBe(true);
    expect(d.semprePreparato("Santuario")).toBe(false);
    expect(incantesimiSottoclasseMancanti(c)).toEqual(["Cura Ferite"]);
    const aggiunto = aggiungiIncantesimi(c, [spell("Cura Ferite", 1, true), spell("Benedizione"), spell("Cura Ferite")]);
    expect(aggiunto.incantesimi.map(s => [s.nome, s.preparato])).toEqual([["Benedizione", true], ["Santuario", true], ["Cura Ferite", true]]);
    expect(aggiungiIncantesimi(c, [spell("Benedizione")])).toBe(c);
    const salito = saliDiLivello({ ...c, incantesimi: [] }, { incantesimi: [spell("Ristorare Inferiore", 2)] });
    expect(salito.incantesimi.map(s => s.nome)).toEqual(["Ristorare Inferiore"]);
  });
});

describe("salita di livello guidata", () => {
  const pg = (classe: string, livello: number, sottoclasse = ""): CharacterData => {
    const c = alston();
    c.info = { ...c.info, classe, livello, sottoclasse };
    c.privilegi = [];
    c.incantesimi = [];
    return c;
  };
  const voce = (id: number, nome: string, livello: number, classi: string[]) => ({ id, nome, livello, scuola: "Invocazione", tempo: "1 azione", classi });

  it("livelli dell'aumento dei punteggi, anche quelli propri della classe", () => {
    expect([4, 6, 8, 10, 14, 19].map(l => haAumentoCaratteristiche("Guerriero", l))).toEqual([true, true, true, false, true, true]);
    expect([6, 10].map(l => haAumentoCaratteristiche("Ladro", l))).toEqual([false, true]);
    expect([5, 6].map(l => haAumentoCaratteristiche("Mago", l))).toEqual([false, false]);
  });

  it("aumento: +2 a una o +1 a due, massimo 20, COS retroattiva", () => {
    const c = pg("Mago", 4);
    c.caratteristiche.INT = { valore: 19, compTS: true };
    expect(applicaAumento(c, { INT: 2 })).toBe(c); // supererebbe 20
    expect(applicaAumento(c, { INT: 1, DES: 1 }).caratteristiche.INT.valore).toBe(20);
    expect(applicaAumento(c, { DES: 1 })).toBe(c); // totale 1
    expect(applicaAumento(c, { DES: 3 })).toBe(c);
    const cos = c.caratteristiche.COS.valore; // 14 → 16: +1 al modificatore
    const r = applicaAumento(c, { COS: 2 });
    expect(r.caratteristiche.COS.valore).toBe(cos + 2);
    expect(r.combattimento.pfMassimi).toBe(c.combattimento.pfMassimi + 4); // 1 PF per livello
  });

  it("salire con un aumento della COS: i PF del nuovo livello e quelli precedenti crescono insieme", () => {
    const c = { ...pg("Mago", 3), caratteristiche: { ...pg("Mago", 3).caratteristiche, COS: { valore: 13, compTS: false } } };
    const semplice = saliDiLivello(c);
    const conCos = saliDiLivello(c, { aumenti: { COS: 1, INT: 1 } });
    expect(conCos.info.livello).toBe(4);
    expect(conCos.combattimento.pfMassimi).toBe(semplice.combattimento.pfMassimi + 4); // 13 → 14: +1 per 4 livelli
    const talento = { nome: "Allerta", fonte: "Talento", descrizione: "" };
    expect(saliDiLivello(c, { talento }).privilegi).toContainEqual(talento);
  });

  it("livello di slot più alto e incantesimi da imparare", () => {
    expect(livelloMassimoIncantesimi(incantatoreDi("Mago", ""), 5)).toBe(3);
    expect(livelloMassimoIncantesimi(incantatoreDi("Paladino", ""), 1)).toBe(0);
    expect(livelloMassimoIncantesimi(incantatoreDi("Warlock", ""), 7)).toBe(4);
    expect(classeDellaLista("Ladro", "Mistificatore Arcano")).toBe("Mago");
    expect(classeDellaLista("Chierico", "Dominio della Vita")).toBe("Chierico");
    const catalogo = [
      voce(1, "Dardo di Fuoco", 0, ["Mago", "Stregone"]), voce(2, "Palla di Fuoco", 3, ["Mago", "Stregone"]),
      voce(3, "Cono di Freddo", 5, ["Mago"]), voce(4, "Comando", 1, ["Chierico", "Paladino"]), voce(5, "Sonno", 1, ["Mago"]),
    ];
    const mago = { ...pg("Mago", 4), incantesimi: [{ id: 5, nome: "Sonno", livello: 1, scuola: "Ammaliamento", tempo: "1 azione", preparato: false }] };
    const m = incantesimiDaImparare(mago, catalogo, 5);
    expect(m.trucchetti.map(i => i.nome)).toEqual(["Dardo di Fuoco"]);
    expect(m.incantesimi.map(i => i.nome)).toEqual(["Palla di Fuoco"]); // Sonno è già nel libro, Cono di Freddo è troppo alto
    // Il patrono Immondo aggiunge Comando alla lista del Warlock.
    expect(incantesimiDaImparare(pg("Warlock", 1, "L'Immondo"), catalogo, 2).incantesimi.map(i => i.nome)).toEqual(["Comando"]);
    expect(incantesimiDaImparare(pg("Ladro", 2), catalogo, 3, "Mistificatore Arcano").incantesimi.map(i => i.nome)).toEqual(["Sonno"]);
    expect(incantesimiDaImparare(pg("Guerriero", 4, "Campione"), catalogo, 5)).toEqual({ trucchetti: [], incantesimi: [] });
  });
});
