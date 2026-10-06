import { beforeAll, describe, expect, it } from "vitest";
import { CLASSI, NOMI_CLASSI } from "@dnd/regole/dati/classi.ts";
import { ABILITA, SCUOLE, parseDado } from "@dnd/regole/regole.ts";
import { catalogoCreazione, privilegiDiClasse } from "../src/catalogo.ts";
import { ARMATURE, SCUDO } from "@dnd/regole/semi/armature.ts";
import { ARMI } from "@dnd/regole/semi/armi.ts";
import { BACKGROUND } from "@dnd/regole/semi/background.ts";
import { PRIVILEGI_CLASSE } from "@dnd/regole/semi/classi.ts";
import { CLASSI_INCANTESIMI, SCHEDE_INCANTESIMI } from "@dnd/regole/semi/incantesimi.ts";
import { RAZZE } from "@dnd/regole/semi/razze.ts";
import type { Esecutore } from "../src/db.ts";
import { archivioDiProva } from "./database.ts";

const idAbilita = new Set(ABILITA.map(a => a.id));
const nomiArmi = new Set(ARMI.map(a => a.nome));
const nomiArmature = new Set([...ARMATURE.map(a => a.nome), SCUDO.nome]);

describe("seed dei cataloghi", () => {
  it("ogni classe ha privilegi di 1° livello, e anche le sottoclassi scelte al 1°", () => {
    for (const classe of NOMI_CLASSI) {
      expect(PRIVILEGI_CLASSE.some(p => p.classe === classe && p.livello === 1 && !p.sottoclasse), classe).toBe(true);
      if (CLASSI[classe].livelloSottoclasse === 1) {
        for (const sottoclasse of CLASSI[classe].sottoclassi) {
          expect(PRIVILEGI_CLASSE.some(p => p.sottoclasse === sottoclasse && p.livello === 1), sottoclasse).toBe(true);
        }
      }
    }
  });

  it("l'equipaggiamento delle classi rimanda ad armi e armature del catalogo", () => {
    for (const classe of NOMI_CLASSI) {
      for (const voce of CLASSI[classe].equipaggiamento.flat().flatMap(o => o.voci)) {
        if (voce.tipo === "arma") expect(nomiArmi.has(voce.nome), `${classe}: ${voce.nome}`).toBe(true);
        if (voce.tipo === "armatura") expect(nomiArmature.has(voce.nome), `${classe}: ${voce.nome}`).toBe(true);
      }
    }
  });

  it("abilità di classi, razze e background sono abilità esistenti", () => {
    for (const classe of NOMI_CLASSI) {
      const lista = CLASSI[classe].abilita.lista;
      if (lista !== "tutte") for (const a of lista) expect(idAbilita.has(a), `${classe}: ${a}`).toBe(true);
    }
    for (const r of RAZZE) for (const a of r.abilita ?? []) expect(idAbilita.has(a), `${r.nome}: ${a}`).toBe(true);
    for (const b of BACKGROUND) for (const a of b.abilita) expect(idAbilita.has(a), `${b.nome}: ${a}`).toBe(true);
  });

  it("razze madri, trucchetti razziali e classi degli incantesimi rimandano a voci esistenti", () => {
    const razze = new Set(RAZZE.map(r => r.nome));
    for (const r of RAZZE) {
      if (r.madre) expect(razze.has(r.madre), r.nome).toBe(true);
      if (r.trucchetto && r.trucchetto !== "*") expect(r.trucchetto in SCHEDE_INCANTESIMI, r.nome).toBe(true);
    }
    for (const nome of Object.keys(CLASSI_INCANTESIMI)) expect(nome in SCHEDE_INCANTESIMI, nome).toBe(true);
  });
});

describe("catalogo degli incantesimi", () => {
  const voci = Object.entries(SCHEDE_INCANTESIMI);
  const perLivello = (l: number) => voci.filter(([, v]) => v.livello === l).length;

  it("copre tutti i livelli, dai trucchetti al 9°, con almeno 350 incantesimi", () => {
    expect(voci.length).toBeGreaterThanOrEqual(350);
    for (let l = 0; l <= 9; l++) expect(perLivello(l), `livello ${l}`).toBeGreaterThanOrEqual(l === 0 ? 20 : 15);
  });

  it("ogni voce ha una scuola valida, almeno una classe e dadi leggibili; i nomi non si ripetono", () => {
    const nomi = new Set<string>();
    for (const [nome, v] of voci) {
      const chiave = nome.trim().toLowerCase();
      expect(nomi.has(chiave), `duplicato: ${nome}`).toBe(false);
      nomi.add(chiave);
      expect(SCUOLE, nome).toContain(v.scuola);
      expect((CLASSI_INCANTESIMI[nome] ?? []).length, `${nome}: nessuna classe`).toBeGreaterThan(0);
      expect(v.descrizione.length, nome).toBeGreaterThan(20);
      if (v.danni) expect(() => parseDado(v.danni!.dado), nome).not.toThrow();
      if (v.danni?.perLivello) expect(() => parseDado(v.danni!.perLivello!), nome).not.toThrow();
    }
  });

  it("i trucchetti hanno una lista di classe, e solo i lanciatori di trucchetti li hanno", () => {
    for (const [nome] of voci.filter(([, x]) => x.livello === 0)) {
      for (const c of CLASSI_INCANTESIMI[nome]) expect(["Bardo", "Chierico", "Druido", "Mago", "Stregone", "Warlock"], `${nome}: ${c}`).toContain(c);
    }
  });
});

describe("catalogo per la creazione", () => {
  let db: Esecutore;
  let catalogo: Awaited<ReturnType<typeof catalogoCreazione>>;
  beforeAll(async () => {
    db = await archivioDiProva();
    catalogo = await catalogoCreazione(db);
  });

  it("le sottorazze indicano la razza madre e portano i loro privilegi e competenze", () => {
    const rocce = catalogo.razze.find(r => r.nome === "Gnomo delle Rocce")!;
    expect(rocce.madre).toBe("Gnomo");
    expect(rocce.bonus).toEqual({ COS: 1 });
    expect(rocce.privilegi.map(p => p.nome)).toEqual(["Conoscenze da Artefice", "Armeggiare"]);
    const nano = catalogo.razze.find(r => r.nome === "Nano")!;
    expect(nano.lingue).toEqual(["Comune", "Nanico"]);
    expect(nano.strumentiAScelta).toHaveLength(3);
    expect(catalogo.razze.find(r => r.nome === "Tiefling")?.trucchetto).toBe("Taumaturgia");
  });

  it("i background portano abilità, equipaggiamento e privilegio", () => {
    const sapiente = catalogo.background.find(b => b.nome === "Sapiente")!;
    expect(sapiente.abilita).toEqual(["arcano", "storia"]);
    expect(sapiente.lingueAScelta).toBe(2);
    expect(sapiente.mo).toBe(10);
    expect(sapiente.privilegio.nome).toBe("Ricercatore");
    expect(sapiente.equipaggiamento.length).toBeGreaterThan(0);
  });

  it("armi, armature e incantesimi con le loro classi", () => {
    expect(catalogo.armi.find(a => a.nome === "Arco Lungo")).toMatchObject({ categoria: "guerra", distanza: true });
    expect(catalogo.armature.find(a => a.nome === "Cotta di Maglia")).toMatchObject({ ca: 16, maxDes: 0 });
    expect(catalogo.incantesimi.find(i => i.nome === "Scudo")?.classi.sort()).toEqual(["Mago", "Stregone"]);
  });

  it("i privilegi di classe si filtrano per livello e sottoclasse", async () => {
    const mago2 = await privilegiDiClasse(db, { classe: "Mago", livello: 2, sottoclasse: "Scuola di Divinazione" });
    expect(mago2.map(p => p.privilegio.nome)).toEqual(["Tradizione Arcana", "Esperto di Divinazione", "Presagio"]);
    const invocazione = await privilegiDiClasse(db, { classe: "Mago", livello: 2, sottoclasse: "Scuola di Invocazione" });
    expect(invocazione.map(p => p.privilegio.nome)).toEqual(["Tradizione Arcana", "Esperto di Invocazione", "Scolpire Incantesimi"]);
    const chierico = await privilegiDiClasse(db, { classe: "Chierico", livello: 1, sottoclasse: "Dominio della Vita" });
    expect(chierico.map(p => p.privilegio.nome)).toContain("Discepolo della Vita");
    expect(chierico.map(p => p.privilegio.nome)).not.toContain("Sacerdote Guerriero");
  });

  it("i privilegi si possono chiedere fino a un livello", async () => {
    const fino3 = (await privilegiDiClasse(db, { classe: "Guerriero", fino: 3, sottoclasse: "Campione" })).map(p => p.privilegio.nome);
    expect(fino3).toContain("Recuperare Energie");
    expect(fino3).toContain("Azione Impetuosa");
    expect(fino3).toContain("Critico Migliorato");
    expect(fino3).not.toContain("Indomito");
    expect(fino3).not.toContain("Superiorità in Combattimento");
  });
});

describe("privilegi di classe dal 2° al 20° livello", () => {
  it("ogni classe ha privilegi di livello superiore e ogni sottoclasse ne ha al suo livello di scelta", () => {
    for (const classe of NOMI_CLASSI) {
      const livelli = new Set(PRIVILEGI_CLASSE.filter(p => p.classe === classe && !p.sottoclasse).map(p => p.livello));
      expect(livelli.has(2) || livelli.has(3), classe).toBe(true);
      expect(livelli.has(CLASSI[classe].livelloSottoclasse), `${classe}: privilegio di scelta della sottoclasse`).toBe(true);
      for (const sottoclasse of CLASSI[classe].sottoclassi) {
        const proprie = PRIVILEGI_CLASSE.filter(p => p.classe === classe && p.sottoclasse === sottoclasse);
        expect(proprie.some(p => p.livello === CLASSI[classe].livelloSottoclasse), sottoclasse).toBe(true);
        expect(proprie.length, sottoclasse).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("classi, sottoclassi e livelli sono validi e nessun privilegio si ripete", () => {
    const viste = new Set<string>();
    for (const p of PRIVILEGI_CLASSE) {
      const regole = CLASSI[p.classe];
      expect(regole, p.classe).toBeDefined();
      if (p.sottoclasse) expect(regole.sottoclassi, p.sottoclasse).toContain(p.sottoclasse);
      expect(p.livello).toBeGreaterThanOrEqual(1);
      expect(p.livello).toBeLessThanOrEqual(20);
      expect(p.privilegio.fonte).toBe(p.sottoclasse ?? p.classe);
      expect(p.privilegio.descrizione.length).toBeGreaterThan(20);
      const chiave = `${p.privilegio.nome}|${p.privilegio.fonte}`.toLowerCase();
      expect(viste.has(chiave), chiave).toBe(false);
      viste.add(chiave);
    }
  });

  it("i privilegi che cambiano i calcoli hanno ancora il nome riconosciuto dalle regole", () => {
    const nomi = new Set(PRIVILEGI_CLASSE.map(p => p.privilegio.nome));
    for (const nome of ["Resilienza Draconica", "Presagio", "Ira"]) expect(nomi.has(nome), nome).toBe(true);
  });
});
