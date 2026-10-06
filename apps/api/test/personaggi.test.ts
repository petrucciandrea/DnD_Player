import { describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "@dnd/regole/dati/alston.ts";
import type { CharacterData } from "@dnd/regole/tipi.ts";
import { creaUtente } from "../src/accesso.ts";
import { apriArchivio } from "../src/archivio.ts";
import { componi, creaPersonaggio, elencoPersonaggi, scomponi } from "../src/personaggi.ts";
import { SCHEDE_INCANTESIMI } from "@dnd/regole/semi/incantesimi.ts";
import { nuovaArma } from "@dnd/regole/regole.ts";

const alston = (): CharacterData => structuredClone(INITIAL_CHARACTER);

const archivio = () => {
  const db = apriArchivio(":memory:");
  return { db, utente: creaUtente(db, "prova", "segretissima")! };
};

describe("personaggi: scomporre e ricomporre la scheda", () => {
  it("la scheda di Alston torna identica, con gli incantesimi completati dal catalogo", () => {
    const { db, utente } = archivio();
    const composta = componi(db, creaPersonaggio(db, utente.id, alston()))!;

    expect({ ...composta, incantesimi: [] }).toEqual({ ...alston(), incantesimi: [] });
    expect(composta.incantesimi.map(s => [s.nome, s.preparato])).toEqual(alston().incantesimi.map(s => [s.nome, s.preparato]));
    for (const s of composta.incantesimi) {
      const { livello, scuola, tempo, ...dettagli } = SCHEDE_INCANTESIMI[s.nome];
      expect({ livello: s.livello, scuola: s.scuola, tempo: s.tempo }).toEqual({ livello, scuola, tempo });
      expect(s.scheda).toEqual(dettagli);
    }
  });

  it("gli incantesimi puntano al catalogo condiviso: due personaggi, una sola voce", () => {
    const { db, utente } = archivio();
    const primo = componi(db, creaPersonaggio(db, utente.id, alston()))!;
    const secondo = componi(db, creaPersonaggio(db, utente.id, alston()))!;
    expect(secondo.incantesimi.map(s => s.id)).toEqual(primo.incantesimi.map(s => s.id));
    expect(db.prepare("SELECT COUNT(*) AS n FROM incantesimi").get()?.n).toBe(Object.keys(SCHEDE_INCANTESIMI).length);
  });

  it("gli id locali dei vecchi salvataggi non contano: le voci si trovano per nome", () => {
    const { db, utente } = archivio();
    const c = alston();
    c.incantesimi = [{ id: 5, nome: "dardo di fuoco", livello: 0, scuola: "Evocazione", tempo: "1 Azione", preparato: true }];
    const [s] = componi(db, creaPersonaggio(db, utente.id, c))!.incantesimi;
    expect(s.nome).toBe("Dardo di Fuoco");
    expect(s.scuola).toBe("Invocazione"); // vale il catalogo
    expect(s.scheda?.danni?.dado).toBe("1d10");
  });

  it("un incantesimo che non è nel catalogo diventa una voce condivisa creata dall'utente", () => {
    const { db, utente } = archivio();
    const c = alston();
    c.incantesimi.push({ id: Date.now(), nome: "Sfera del Gnomo", livello: 2, scuola: "Invocazione", tempo: "1 azione", preparato: false });
    const s = componi(db, creaPersonaggio(db, utente.id, c))!.incantesimi.at(-1)!;
    expect(s).toMatchObject({ nome: "Sfera del Gnomo", livello: 2, preparato: false });
    expect(s.scheda).toBeUndefined();
    expect(db.prepare("SELECT creato_da FROM incantesimi WHERE nome = ?").get("Sfera del Gnomo")?.creato_da).toBe(utente.id);
  });

  it("anche armi e privilegi nuovi finiscono nel catalogo, quelli noti no", () => {
    const { db, utente } = archivio();
    const c = alston();
    c.armi.push(nuovaArma({ nome: "Lancia del Gnomo", dado: "1d8", tipoDanno: "Perforante", proprieta: "Speciale", accurata: false }, 3));
    c.privilegi.push({ nome: "Scurovisione", fonte: "Drow", descrizione: "Vede fino a 36 m." });
    const composta = componi(db, creaPersonaggio(db, utente.id, c))!;
    expect(composta.armi.map(a => a.nome)).toEqual(["Bastone Ferrato", "Pugnale", "Lancia del Gnomo"]);
    expect(composta.privilegi.filter(p => p.nome === "Scurovisione").map(p => p.fonte)).toEqual(["Gnomo", "Drow"]);
    expect(db.prepare("SELECT creato_da FROM armi WHERE nome = 'Lancia del Gnomo'").get()?.creato_da).toBe(utente.id);
    expect(db.prepare("SELECT creato_da FROM armi WHERE nome = 'Pugnale'").get()?.creato_da).toBeNull();
  });

  it("scrivere di nuovo sostituisce le liste e conserva l'ordine", () => {
    const { db, utente } = archivio();
    const id = creaPersonaggio(db, utente.id, alston());
    const c = alston();
    c.inventario = [...c.inventario].reverse().slice(0, 3);
    c.xp.storico.push({ id: 2, data: "Sessione 2", valore: 300, motivo: "Drago" });
    c.incantesimi = c.incantesimi.slice(0, 2);
    c.competenzeAbilita = ["storia"];
    c.concentrazione = "Tocco Gelido";
    scomponi(db, id, c, utente.id);
    const composta = componi(db, id)!;
    expect(composta.inventario).toEqual(c.inventario);
    expect(composta.xp.storico).toEqual(c.xp.storico);
    expect(composta.incantesimi.map(s => s.nome)).toEqual(["Dardo di Fuoco", "Interdizione alle Lame"]);
    expect(composta.competenzeAbilita).toEqual(["storia"]);
    expect(composta.concentrazione).toBe("Tocco Gelido");
  });

  it("taglia, competenze, armatura e scudo fanno andata e ritorno", () => {
    const { db, utente } = archivio();
    const c = alston();
    c.info.taglia = "Media";
    c.competenzeAltre = { lingue: ["Comune", "Nanico"], strumenti: ["Strumenti da fabbro"], armi: ["Armi da guerra"], armature: ["Scudi"] };
    c.armatura = { nome: "Cotta di Maglia", categoria: "leggera", ca: 99, maxDes: null, forzaMin: 0, svantaggioFurtivita: false, peso: 1 };
    c.scudo = true;
    const composta = componi(db, creaPersonaggio(db, utente.id, c))!;
    expect(composta.info.taglia).toBe("Media");
    expect(composta.competenzeAltre).toEqual(c.competenzeAltre);
    expect(composta.scudo).toBe(true);
    // L'armatura è quella del catalogo, non i valori inviati dal client.
    expect(composta.armatura).toMatchObject({ nome: "Cotta di Maglia", categoria: "pesante", ca: 16, maxDes: 0, forzaMin: 13 });
  });

  it("l'elenco mostra solo i personaggi dell'utente", () => {
    const { db, utente } = archivio();
    const altro = creaUtente(db, "altro", "segretissima")!;
    const id = creaPersonaggio(db, utente.id, alston());
    creaPersonaggio(db, altro.id, alston());
    expect(elencoPersonaggi(db, utente.id)).toEqual([
      { id, nome: "Alston il Breve", classe: "Mago", sottoclasse: "Scuola di Divinazione", livello: 3, razza: "Gnomo delle Rocce", avatar: "" },
    ]);
  });

  it("risorse, condizioni, indebolimento, effetti e note fanno andata e ritorno", () => {
    const { db, utente } = archivio();
    const c = alston();
    c.risorseUsate = { "punti-ki": 2, ira: 1 };
    c.condizioni = ["prono", "avvelenato"];
    c.indebolimento = 3;
    c.effetti = [{ id: "ira" }, { id: "immagine-speculare", valore: 2 }];
    c.note = [
      {
        id: 7, data: "30/9/2026", categoria: "png", titolo: "Il locandiere", testo: "Sa dell'osservatorio.\nSecondo rigo.", fatto: false,
        campi: { razza: "Halfling", classe: "Ladro", atteggiamento: "Amichevole" },
      },
      { id: 8, data: "30/9/2026", categoria: "obiettivo", titolo: "Trovare la chiave", testo: "", fatto: true, campi: {} },
    ];
    const id = creaPersonaggio(db, utente.id, c);
    expect({ ...componi(db, id)!, incantesimi: [] }).toEqual({ ...c, incantesimi: [] });
    // Riscrivere con meno dati sostituisce, non accumula.
    const meno = { ...c, risorseUsate: {}, condizioni: [], effetti: [], note: [], indebolimento: 0 };
    scomponi(db, id, meno, utente.id);
    expect({ ...componi(db, id)!, incantesimi: [] }).toEqual({ ...meno, incantesimi: [] });
  });

  it("armi con bonus, munizioni, durabilità e stato fanno andata e ritorno, anche due uguali", () => {
    const { db, utente } = archivio();
    const c = alston();
    const pugnale = c.armi[1];
    c.armi = [
      ...c.armi,
      { ...pugnale, id: 10, bonus: 1, munizioni: { rimasti: 3, massimo: 5 }, durabilita: { rimasti: 0, massimo: 4 }, rotta: true },
      { ...nuovaArma({ nome: "Arco Corto", dado: "1d6", tipoDanno: "Perforante", proprieta: "Munizioni", accurata: false }, 11),
        munizioni: { rimasti: 12, massimo: 20 } },
    ];
    c.armi[0] = { ...c.armi[0], danneggiata: 2 };
    const composta = componi(db, creaPersonaggio(db, utente.id, c))!;
    expect(composta.armi.map(a => [a.id, a.nome])).toEqual([[1, "Bastone Ferrato"], [2, "Pugnale"], [10, "Pugnale"], [11, "Arco Corto"]]);
    expect(composta.armi[2]).toEqual(c.armi[2]);
    expect(composta.armi[0]).toMatchObject({ danneggiata: 2, durabilita: null, rotta: false });
    expect(composta.armi[1]).toMatchObject({ danneggiata: null, durabilita: null });
    // I dati dell'arco sono quelli del catalogo, i contatori quelli della copia del personaggio.
    expect(composta.armi[3]).toMatchObject({ distanza: true, categoria: "semplice", munizioni: { rimasti: 12, massimo: 20 }, durabilita: null });
  });

  it("l'avatar fa andata e ritorno e compare nell'elenco", () => {
    const { db, utente } = archivio();
    const c = alston();
    c.info.avatar = "data:image/jpeg;base64,AAAA";
    const id = creaPersonaggio(db, utente.id, c);
    expect(componi(db, id)!.info.avatar).toBe(c.info.avatar);
    expect(elencoPersonaggi(db, utente.id)[0].avatar).toBe(c.info.avatar);
  });
});
