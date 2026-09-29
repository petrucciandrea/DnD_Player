import { describe, expect, it } from "vitest";
import { CLASSI, NOMI_CLASSI } from "../src/dati/classi.ts";
import { ABILITA } from "../src/regole.ts";
import { apriArchivio } from "./archivio.ts";
import { catalogoCreazione, privilegiDiClasse } from "./catalogo.ts";
import { ARMATURE, SCUDO } from "./semi/armature.ts";
import { ARMI } from "./semi/armi.ts";
import { BACKGROUND } from "./semi/background.ts";
import { PRIVILEGI_CLASSE } from "./semi/classi.ts";
import { CLASSI_INCANTESIMI, SCHEDE_INCANTESIMI } from "./semi/incantesimi.ts";
import { RAZZE } from "./semi/razze.ts";

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

describe("catalogo per la creazione", () => {
  const db = apriArchivio(":memory:");
  const catalogo = catalogoCreazione(db);

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

  it("i privilegi di classe si filtrano per livello e sottoclasse", () => {
    const mago2 = privilegiDiClasse(db, { classe: "Mago", livello: 2, sottoclasse: "Scuola di Divinazione" });
    expect(mago2.map(p => p.privilegio.nome)).toEqual(["Esperto di Divinazione", "Presagio"]);
    expect(privilegiDiClasse(db, { classe: "Mago", livello: 2, sottoclasse: "Scuola di Invocazione" })).toEqual([]);
    const chierico = privilegiDiClasse(db, { classe: "Chierico", livello: 1, sottoclasse: "Dominio della Vita" });
    expect(chierico.map(p => p.privilegio.nome)).toContain("Discepolo della Vita");
    expect(chierico.map(p => p.privilegio.nome)).not.toContain("Sacerdote Guerriero");
  });
});
