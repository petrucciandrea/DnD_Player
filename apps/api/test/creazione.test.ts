import { describe, expect, it } from "vitest";
import {
  abilitaDoppie, bonusRazziali, cambiaScelte, equipaggiamentoIniziale, mancaNelPasso, passiDi, personaggioCreato,
  personaggioIniziale, preparabiliAllaCreazione, primoLivelloIncantesimi, razzaCompleta, scelteVuote, sommaMigliori3, type SceltePersonaggio,
} from "@dnd/regole/creazione.ts";
import { CLASSI } from "@dnd/regole/dati/classi.ts";
import { incantesimiDiSottoclasse } from "@dnd/regole/dati/incantesimiSottoclasse.ts";
import { derivate, incantesimiDaImparare, spellDaCatalogo, type SceltaSalita } from "@dnd/regole/regole.ts";
import { daJSON } from "@dnd/regole/scheda.ts";
import { catalogoCreazione, privilegiDiClasse } from "../src/catalogo.ts";
import { creaUtente } from "../src/accesso.ts";
import { componi, creaPersonaggio } from "../src/personaggi.ts";
import { archivioDiProva } from "./database.ts";

const archivio = await archivioDiProva();
const catalogo = await catalogoCreazione(archivio);

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

  it("la dotazione da esploratore si scompone in oggetti e provviste, per 29,5 kg in tutto", () => {
    const eq = equipaggiamentoIniziale(CLASSI.Barbaro, CLASSI.Barbaro.equipaggiamento.map(() => ({ opzione: 0, armi: [] })), null, catalogo);
    const nomi = eq.oggetti.map(o => o.nome);
    expect(nomi).toEqual(expect.arrayContaining(["Zaino", "Giaciglio", "Razioni", "Otre d'acqua", "Torcia"]));
    expect(nomi).not.toContain("Dotazione da esploratore");
    expect(eq.oggetti.find(o => o.nome === "Razioni")).toMatchObject({ qta: 10, consumabile: true, consumoGiornaliero: 3 });
    expect(eq.oggetti.find(o => o.nome === "Corda di canapa (15 m)")?.consumabile).toBeUndefined();
    expect(eq.oggetti.reduce((peso, o) => peso + o.peso * o.qta, 0)).toBe(29.5);
  });

  it("l'equipaggiamento di ogni classe si costruisce con le opzioni predefinite", () => {
    for (const [nome, regole] of Object.entries(CLASSI)) {
      const armaQualsiasi = catalogo.armi.find(a => a.categoria === "semplice" && !a.distanza)!.nome;
      const eq = equipaggiamentoIniziale(regole, regole.equipaggiamento.map(() => ({ opzione: 0, armi: [armaQualsiasi, armaQualsiasi] })), null, catalogo);
      expect(eq.armi.length + eq.oggetti.length, nome).toBeGreaterThan(0);
    }
  });
});

describe("creazione oltre il 1° livello", () => {
  const privilegiDi = async (classe: string, livello: number, sottoclasse = "") =>
    (await privilegiDiClasse(archivio, { classe, livello, sottoclasse })).map(p => p.privilegio);

  const guerriero = (s: Partial<SceltePersonaggio> = {}) => scelte({
    razza: "Mezzorco", classe: "Guerriero", abilitaClasse: ["atletica", "percezione"], scelteClasse: { "stile-guerriero": ["Difesa"] },
    assegnazione: { FOR: 0, COS: 1, DES: 2, SAG: 3, CAR: 4, INT: 5 },
    background: "Soldato", abilitaSostitutive: ["sopravvivenza", "storia"], strumentoBackground: "Dadi",
    equipaggiamento: [{ opzione: 0, armi: [] }, { opzione: 0, armi: ["Spada Lunga"] }, { opzione: 1, armi: [] }, { opzione: 1, armi: [] }],
    ...s,
  });

  it("il passo Livelli c'è solo oltre il 1° livello e chiede tutte le salite", () => {
    expect(passiDi({ livello: 1 }).map(p => p.id)).not.toContain("livelli");
    expect(passiDi({ livello: 3 }).map(p => p.id)).toEqual(
      ["razza", "classe", "caratteristiche", "background", "equipaggiamento", "incantesimi", "livelli", "dettagli"]);
    expect(mancaNelPasso("livelli", guerriero({ livello: 3, salite: [{}] }), catalogo)).toBe("Completa il livello 3.");
    expect(mancaNelPasso("livelli", guerriero({ livello: 3, salite: [{}, {}] }), catalogo)).toBeNull();
    expect(mancaNelPasso("classe", guerriero({ livello: 21 }), catalogo)).toBe("Scegli un livello tra 1 e 20.");
  });

  it("cambiare una scelta precedente azzera le salite; i dettagli no, il livello le tronca", () => {
    const s = guerriero({ livello: 4, salite: [{ tiroPf: 3 }, { tiroPf: 4 }, { tiroPf: 5 }], preparati: ["Benedizione"] });
    expect(cambiaScelte(s, { razza: "Umano" })).toMatchObject({ salite: [], preparati: [] });
    expect(cambiaScelte(s, { preparati: [] }).salite).toHaveLength(3);
    expect(cambiaScelte(s, { salite: [] }).preparati).toEqual(["Benedizione"]);
    expect(cambiaScelte(s, { tiri: [] }).salite).toEqual([]);
    expect(cambiaScelte(s, { dettagli: { ...s.dettagli, nome: "Altro" } }).salite).toHaveLength(3);
    expect(cambiaScelte(s, { livello: 2 }).salite).toEqual([{ tiroPf: 3 }]);
    expect(cambiaScelte(s, { salite: [] }).salite).toEqual([]);
  });

  it("Guerriero al 3°: PF dei livelli, sottoclasse scelta salendo, privilegi e XP", async () => {
    const salite: SceltaSalita[] = [
      { tiroPf: 7, privilegi: await privilegiDi("Guerriero", 2) },
      { sottoclasse: "Campione", privilegi: await privilegiDi("Guerriero", 3, "Campione") }, // media: 6
    ];
    const c = personaggioCreato(guerriero({ livello: 3, salite }), catalogo);
    expect(c.info).toMatchObject({ livello: 3, sottoclasse: "Campione" });
    expect(c.combattimento).toMatchObject({ pfMassimi: 12 + (7 + 2) + (6 + 2), pfAttuali: 29, dadiVitaRimanenti: 3 });
    expect(c.xp.totale).toBe(900);
    const nomi = c.privilegi.map(p => p.nome);
    for (const p of salite.flatMap(x => x.privilegi ?? [])) expect(nomi).toContain(p.nome);
    expect(derivate(c).puoSalire).toBe(false);
    expect(daJSON(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it("Chierico al 3°: incantesimi di dominio preparati e tutta la lista fino al 2° livello", () => {
    const c = personaggioCreato(scelte({
      razza: "Umano", lingueRazza: ["Celestiale"], classe: "Chierico", sottoclasse: "Dominio della Vita",
      abilitaClasse: ["medicina", "persuasione"],
      assegnazione: { SAG: 0, COS: 1, FOR: 2, DES: 3, CAR: 4, INT: 5 },
      background: "Accolito", lingueBackground: ["Nanico", "Elfico"],
      equipaggiamento: [{ opzione: 0, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }],
      trucchetti: ["Taumaturgia"],
      livello: 3, salite: [{}, {}],
    }), catalogo);
    const stato = new Map(c.incantesimi.map(s => [s.nome, s.preparato]));
    for (const n of incantesimiDiSottoclasse(c).sempre) expect(stato.get(n), n).toBe(true);
    expect(stato.has("Arma Spirituale")).toBe(true);
    const lista = catalogo.incantesimi.filter(i => i.classi.includes("Chierico") && i.livello >= 1 && i.livello <= 2);
    expect(lista.some(i => i.livello === 2)).toBe(true);
    for (const i of lista) expect(stato.has(i.nome), i.nome).toBe(true);
    expect(c.incantesimi.some(s => s.livello === 3)).toBe(false);
    expect(derivate(c).slotMax).toEqual([4, 2]);
  });

  it("Mago al 4°: due incantesimi a livello nel libro e aumento dell'INT", () => {
    const base = scelte({
      razza: "Elfo", sottorazza: "Alto Elfo", lingueRazza: ["Draconico"], trucchettoRazza: "Luci Danzanti",
      classe: "Mago", abilitaClasse: ["arcano", "storia"],
      assegnazione: { INT: 0, DES: 1, COS: 2, SAG: 3, CAR: 4, FOR: 5 },
      background: "Sapiente", abilitaSostitutive: ["indagare", "religione"], lingueBackground: ["Nanico", "Gnomesco"],
      equipaggiamento: [{ opzione: 0, armi: [] }, { opzione: 1, armi: [] }, { opzione: 0, armi: [] }, { opzione: 0, armi: [] }],
      trucchetti: ["Dardo di Fuoco", "Tocco Gelido", "Interdizione alle Lame"],
      incantesimi: ["Dardo Incantato", "Mani Brucianti", "Scudo", "Charm su Persone", "Onda Tuonante", "Ritirata Rapida"],
      livello: 4,
    });
    // Ogni salita copia nel libro due incantesimi imparabili (i più alti), come dal pannello.
    let s = base;
    for (let livello = 2; livello <= 4; livello++) {
      const attuale = personaggioCreato(s, catalogo);
      const imparabili = incantesimiDaImparare(attuale, catalogo.incantesimi, livello);
      const libro = [...imparabili.incantesimi].sort((a, b) => b.livello - a.livello).slice(0, 2).map(i => spellDaCatalogo(i, false));
      const salita: SceltaSalita = livello === 4
        ? { aumenti: { INT: 2 }, incantesimi: [...libro, ...imparabili.trucchetti.slice(0, 1).map(i => spellDaCatalogo(i, true))] }
        : { incantesimi: libro };
      s = { ...s, salite: [...s.salite, salita] };
    }
    const c = personaggioCreato(s, catalogo);
    expect(c.info.livello).toBe(4);
    expect(c.caratteristiche.INT.valore).toBe(18);
    expect(c.incantesimi.filter(i => i.livello >= 1)).toHaveLength(6 + 2 + 2 + 2);
    expect(c.incantesimi.some(i => i.livello === 2)).toBe(true);
    expect(c.incantesimi.filter(i => i.livello === 0)).toHaveLength(3 + 1 + 1); // con il trucchetto razziale
    expect(c.xp.totale).toBe(2700);
    expect(derivate(c).cdMagia).toBe(8 + 2 + 4);
  });

  const paladino = (s: Partial<SceltePersonaggio> = {}) => scelte({
    razza: "Dragonide", sottorazza: catalogo.razze.find(r => r.madre === "Dragonide")?.nome ?? "", classe: "Paladino",
    abilitaClasse: ["atletica", "intuizione"], assegnazione: { FOR: 0, CAR: 1, COS: 2, DES: 3, SAG: 4, INT: 5 },
    background: "Accolito", lingueBackground: ["Nanico", "Elfico"], ...s,
  });

  it("primo livello con incantesimi: Paladino e Ranger dal 2°, gli altri incantatori dal 1°", () => {
    expect(["Paladino", "Ranger", "Mago", "Chierico", "Warlock", "Guerriero"].map(primoLivelloIncantesimi)).toEqual([2, 2, 1, 1, 1, null]);
  });

  it("Paladino al 3°: sceglie i preparati fino al limite, quelli del giuramento non contano", async () => {
    const salite: SceltaSalita[] = [{}, { sottoclasse: "Giuramento di Devozione", privilegi: await privilegiDi("Paladino", 3, "Giuramento di Devozione") }];
    const senza = personaggioCreato(paladino({ livello: 3, salite }), catalogo);
    const { opzioni, massimo } = preparabiliAllaCreazione(senza);
    expect(massimo).toBe(3); // metà livello (1) + CAR 14 (+2)
    expect(opzioni.map(o => o.nome)).not.toContain("Santuario"); // del giuramento: sempre preparato
    expect(opzioni.every(o => o.livello === 1)).toBe(true);
    const scelti = ["Punizione Tonante", "Benedizione", "Cura Ferite", "Eroismo", "Santuario"];
    const c = personaggioCreato(paladino({ livello: 3, salite, preparati: scelti }), catalogo);
    const preparati = c.incantesimi.filter(i => i.preparato).map(i => i.nome);
    expect(preparati).toEqual(expect.arrayContaining(["Benedizione", "Cura Ferite", "Santuario"]));
    expect(derivate(c).preparatiAttuali).toBe(3); // il quarto oltre il limite si ignora, Santuario non conta
    expect(preparabiliAllaCreazione(personaggioCreato(paladino(), catalogo)).massimo).toBe(0); // al 1° non incanta
    expect(preparabiliAllaCreazione(personaggioCreato(guerriero({ livello: 3, salite: [{}, {}] }), catalogo)).massimo).toBe(0);
  });
});
