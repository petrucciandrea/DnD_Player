import { describe, expect, it } from "vitest";
import {
  abilitaDoppie, bonusRazziali, equipaggiamentoIniziale, mancaNelPasso, personaggioIniziale, razzaCompleta, scelteVuote,
  sommaMigliori3, type SceltePersonaggio,
} from "@dnd/regole/creazione.ts";
import { CLASSI } from "@dnd/regole/dati/classi.ts";
import { derivate } from "@dnd/regole/regole.ts";
import { daJSON } from "@dnd/regole/scheda.ts";
import { catalogoCreazione } from "../src/catalogo.ts";
import { creaUtente } from "../src/accesso.ts";
import { componi, creaPersonaggio } from "../src/personaggi.ts";
import { archivioDiProva } from "./database.ts";

const catalogo = await catalogoCreazione(await archivioDiProva());

// Tiri che danno 15, 14, 13, 12, 10, 8 (il dado più basso viene scartato).
const TIRI = [[5, 5, 5, 1], [5, 5, 4, 2], [5, 4, 4, 1], [4, 4, 4, 3], [4, 3, 3, 2], [3, 3, 2, 1]];

const scelte = (s: Partial<SceltePersonaggio>): SceltePersonaggio => {
  const base = scelteVuote();
  return { ...base, tiri: TIRI, ...s, dettagli: { ...base.dettagli, nome: "Prova", ...s.dettagli } };
};

describe("creazione: elementi", () => {
  it("4d6 scartando il dado più basso", () => {
    expect(sommaMigliori3([1, 6, 3, 4])).toBe(13);
    expect(TIRI.map(sommaMigliori3)).toEqual([15, 14, 13, 12, 10, 8]);
  });

  it("la sottorazza si somma alla razza madre", () => {
    const colline = razzaCompleta(catalogo, "Nano", "Nano delle Colline")!;
    expect(colline.bonus).toEqual({ COS: 2, SAG: 1 });
    expect(colline.velocita).toBe("7,5 m");
    expect(colline.privilegi.map(p => p.nome)).toContain("Robustezza Nanica");
    expect(razzaCompleta(catalogo, "Elfo", "Elfo dei Boschi")?.velocita).toBe("10,5 m");
  });

  it("bonus razziali dell'Umano e del Mezzelfo (+1 a scelta)", () => {
    expect(bonusRazziali(razzaCompleta(catalogo, "Umano", ""), [])).toEqual({ FOR: 1, DES: 1, COS: 1, INT: 1, SAG: 1, CAR: 1 });
    expect(bonusRazziali(razzaCompleta(catalogo, "Mezzelfo", ""), ["DES", "COS"])).toMatchObject({ CAR: 2, DES: 1, COS: 1, FOR: 0 });
  });

  it("un'abilità del background già presa va sostituita", () => {
    const razza = razzaCompleta(catalogo, "Mezzorco", "");
    const soldato = catalogo.background.find(b => b.nome === "Soldato")!;
    expect(abilitaDoppie(scelte({ abilitaClasse: ["atletica", "percezione"] }), razza, soldato)).toEqual(["atletica", "intimidire"]);
  });

  it("il catalogo contiene le opzioni delle scelte di privilegio", () => {
    const perFonte = (fonte: string) => catalogo.opzioniPrivilegio.filter(p => p.fonte === fonte).map(p => p.nome);
    expect(perFonte("Metamagia")).toHaveLength(8);
    expect(perFonte("Stile di Combattimento")).toEqual(expect.arrayContaining(["Difesa", "Duellare", "Tiro", "Protezione"]));
    expect(perFonte("Terreno del Circolo")).toHaveLength(8);
  });

  it("i passi segnalano cosa manca", () => {
    expect(mancaNelPasso("razza", scelte({ razza: "Nano" }), catalogo)).toMatch(/sottorazza/);
    expect(mancaNelPasso("classe", scelte({ classe: "Chierico", abilitaClasse: ["storia", "medicina"] }), catalogo)).toMatch(/sottoclasse/);
    expect(mancaNelPasso("caratteristiche", scelte({ razza: "Umano" }), catalogo)).toMatch(/Assegna/);
    expect(mancaNelPasso("incantesimi", scelte({ classe: "Guerriero" }), catalogo)).toBeNull();
    const guerriero = { classe: "Guerriero" as const, abilitaClasse: ["atletica", "percezione"] };
    expect(mancaNelPasso("classe", scelte(guerriero), catalogo)).toMatch(/Stile di Combattimento/);
    expect(mancaNelPasso("classe", scelte({ ...guerriero, scelteClasse: { "stile-guerriero": ["Tiro"] } }), catalogo)).toBeNull();
  });
});

describe("creazione: personaggi completi", () => {
  it("Mezzorco Guerriero con cotta di maglia, spada lunga e scudo", () => {
    const c = personaggioIniziale(scelte({
      razza: "Mezzorco", classe: "Guerriero", abilitaClasse: ["atletica", "percezione"], scelteClasse: { "stile-guerriero": ["Difesa"] },
      assegnazione: { FOR: 0, COS: 1, DES: 2, SAG: 3, CAR: 4, INT: 5 },
      background: "Soldato", abilitaSostitutive: ["sopravvivenza", "storia"], strumentoBackground: "Dadi",
      equipaggiamento: [{ opzione: 0, armi: [] }, { opzione: 0, armi: ["Spada Lunga"] }, { opzione: 1, armi: [] }, { opzione: 1, armi: [] }],
    }), catalogo);
    expect(c.caratteristiche.FOR).toEqual({ valore: 17, compTS: true });
    expect(c.caratteristiche.COS).toEqual({ valore: 15, compTS: true });
    expect(c.combattimento).toMatchObject({ pfAttuali: 12, pfMassimi: 12, dadiVitaRimanenti: 1 }); // 10 + 2
    expect(c.armatura?.nome).toBe("Cotta di Maglia");
    expect(c.scudo).toBe(true);
    expect(c.armi.map(a => a.nome)).toEqual(["Spada Lunga", "Ascia"]);
    expect(c.armi.map(a => a.id)).toEqual([1, 2]);
    expect(c.armi.every(a => a.bonus === 0 && a.munizioni === null && a.durabilita === null && !a.rotta)).toBe(true);
    expect(c.competenzeAbilita.sort()).toEqual(["atletica", "intimidire", "percezione", "sopravvivenza", "storia"]);
    expect(c.competenzeAltre.lingue).toEqual(["Comune", "Orchesco"]);
    expect(c.monete.mo).toBe(10);
    const d = derivate(c);
    expect(d.ca).toBe(19); // cotta di maglia 16, scudo +2, stile Difesa +1
    expect(c.privilegi).toContainEqual(expect.objectContaining({ nome: "Difesa", fonte: "Stile di Combattimento" }));
    expect(d.haIncantesimi).toBe(false);
    expect(d.haPresagio).toBe(false);
    expect(c.privilegi.map(p => p.nome)).toEqual(expect.arrayContaining(["Tenacia Implacabile", "Grado Militare", "Recuperare Energie"]));
  });

  it("Chierico Umano del Dominio della Vita", () => {
    const c = personaggioIniziale(scelte({
      razza: "Umano", lingueRazza: ["Celestiale"], classe: "Chierico", sottoclasse: "Dominio della Vita",
      abilitaClasse: ["medicina", "persuasione"],
      assegnazione: { SAG: 0, COS: 1, FOR: 2, DES: 3, CAR: 4, INT: 5 },
      background: "Accolito", lingueBackground: ["Nanico", "Elfico"],
      equipaggiamento: [{ opzione: 0, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }],
      trucchetti: ["Taumaturgia"],
    }), catalogo);
    const d = derivate(c);
    expect(c.caratteristiche.SAG.valore).toBe(16);
    expect(d.cdMagia).toBe(13); // 8 + 2 + 3
    expect(d.slotMax).toEqual([2]);
    expect(c.combattimento.pfMassimi).toBe(10); // 8 + COS 2
    expect(c.privilegi.map(p => p.nome)).toContain("Discepolo della Vita");
    expect(c.privilegi.map(p => p.nome)).not.toContain("Sacerdote Guerriero");
    // Gli incantesimi di dominio sono sempre preparati e non contano nel limite; chi prepara dall'intera lista
    // riceve anche tutti quelli di 1° livello della classe presenti nel catalogo, da preparare.
    const stato = Object.fromEntries(c.incantesimi.map(s => [s.nome, s.preparato]));
    expect(stato).toMatchObject({ "Benedizione": true, "Cura Ferite": true, "Taumaturgia": true, "Individuazione del Magico": false, "Santuario": false });
    expect(c.incantesimi.filter(s => s.nome === "Benedizione")).toHaveLength(1);
    expect(d.incantesimiSempre).toEqual(["Benedizione", "Cura Ferite"]);
    expect(d.preparatiAttuali).toBe(0);
    expect(c.competenzeAltre.lingue).toEqual(["Comune", "Celestiale", "Nanico", "Elfico"]);
    expect(c.armatura?.nome).toBe("Armatura di Scaglie");
  });

  it("Nano delle Colline Barbaro: Robustezza Nanica e strumento scelto", () => {
    const c = personaggioIniziale(scelte({
      razza: "Nano", sottorazza: "Nano delle Colline", strumentoRazza: "Strumenti da fabbro",
      classe: "Barbaro", abilitaClasse: ["atletica", "sopravvivenza"],
      assegnazione: { FOR: 0, COS: 1, DES: 2, SAG: 3, CAR: 4, INT: 5 },
      background: "Eroe Popolare", abilitaSostitutive: ["percezione"], strumentoBackground: "Strumenti da falegname",
      equipaggiamento: [{ opzione: 1, armi: ["Maglio"] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }],
    }), catalogo);
    expect(c.combattimento.pfMassimi).toBe(12 + 3 + 1); // d12 + COS 16 + Robustezza
    expect(c.competenzeAltre.strumenti).toEqual(["Strumenti da fabbro", "Veicoli (terrestri)", "Strumenti da falegname"]);
    expect(derivate(c).ca).toBe(10 + 1 + 3); // Difesa Senza Armatura: DES 13, COS 16
    expect(c.info.taglia).toBe("Media");
  });

  it("Alto Elfo Mago: trucchetto razziale e sei incantesimi nel libro", () => {
    const libro = ["Dardo Incantato", "Mani Brucianti", "Scudo", "Charm su Persone", "Onda Tuonante", "Ritirata Rapida"];
    const c = personaggioIniziale(scelte({
      razza: "Elfo", sottorazza: "Alto Elfo", lingueRazza: ["Draconico"], trucchettoRazza: "Luci Danzanti",
      classe: "Mago", abilitaClasse: ["arcano", "storia"],
      assegnazione: { INT: 0, DES: 1, COS: 2, SAG: 3, CAR: 4, FOR: 5 },
      background: "Sapiente", abilitaSostitutive: ["indagare", "religione"], lingueBackground: ["Nanico", "Gnomesco"],
      equipaggiamento: [{ opzione: 0, armi: [] }, { opzione: 1, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }],
      trucchetti: ["Dardo di Fuoco", "Tocco Gelido", "Interdizione alle Lame"], incantesimi: libro,
    }), catalogo);
    expect(c.caratteristiche.INT.valore).toBe(16);
    expect(c.incantesimi.filter(s => s.livello === 1).every(s => !s.preparato)).toBe(true);
    expect(c.incantesimi.map(s => s.nome)).toEqual(["Dardo di Fuoco", "Tocco Gelido", "Interdizione alle Lame", ...libro, "Luci Danzanti"]);
    expect(c.incantesimi.find(s => s.nome === "Scudo")?.scheda).toBeDefined();
    expect(c.combattimento.pfMassimi).toBe(6 + 1); // d6 + COS 13
    expect(derivate(c).maxPreparabili).toBe(4); // 1 + INT 3
  });

  it("la scheda creata supera la validazione e fa andata e ritorno nell'archivio", async () => {
    const c = personaggioIniziale(scelte({
      razza: "Tiefling", classe: "Warlock", sottoclasse: "L'Immondo", abilitaClasse: ["arcano", "inganno"],
      assegnazione: { CAR: 0, COS: 1, DES: 2, SAG: 3, INT: 4, FOR: 5 },
      background: "Ciarlatano",
      equipaggiamento: [{ opzione: 1, armi: ["Pugnale"] }, { opzione: 1, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: ["Lancia"] }],
    }), catalogo);
    expect(daJSON(JSON.parse(JSON.stringify(c)))).toEqual(c);
    const db = await archivioDiProva();
    const utente = (await creaUtente(db, "prova", "segretissima"))!;
    const composta = (await componi(db, await creaPersonaggio(db, utente.id, c)))!;
    expect(composta.info).toEqual(c.info);
    expect(composta.competenzeAltre).toEqual(c.competenzeAltre);
    expect(composta.armatura?.nome).toBe("Armatura di Cuoio");
    expect(composta.incantesimi.map(s => s.nome)).toEqual(["Taumaturgia"]);
    expect(derivate(composta).slotMax).toEqual([1]);
  });

  it("l'equipaggiamento di ogni classe si costruisce con le opzioni predefinite", () => {
    for (const [nome, regole] of Object.entries(CLASSI)) {
      const armaQualsiasi = catalogo.armi.find(a => a.categoria === "semplice" && !a.distanza)!.nome;
      const eq = equipaggiamentoIniziale(regole, regole.equipaggiamento.map(() => ({ opzione: 0, armi: [armaQualsiasi, armaQualsiasi] })), null, catalogo);
      expect(eq.armi.length + eq.oggetti.length, nome).toBeGreaterThan(0);
    }
  });
});
