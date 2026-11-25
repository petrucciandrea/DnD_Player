import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "@dnd/regole/dati/alston.ts";
import type { Combattimento, DettaglioParty, MessaggiParty, Tesoro, VoceDiario } from "@dnd/regole/api.ts";
import { costruisciApp } from "../src/app.ts";
import { creaUtente } from "../src/accesso.ts";
import { normalizzaCodice, nuovoCodice } from "../src/party.ts";
import { componiMolti, creaPersonaggio } from "../src/personaggi.ts";
import { archivioDiProva } from "./database.ts";

const app: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(app.splice(0).map(a => a.close()));
});

const cookieDa = (intestazione: string | string[] | number | undefined) =>
  String(Array.isArray(intestazione) ? intestazione[0] : intestazione).split(";")[0];

const alston = (nome = "Alston") => {
  const c = structuredClone(INITIAL_CHARACTER);
  c.info.nome = nome;
  return c;
};

// Un'app con più utenti registrati: `chiama(utente, metodo, url, corpo)` usa il cookie di quell'utente.
async function tavolo(...usernames: string[]) {
  const a = await costruisciApp({ db: await archivioDiProva(), produzione: false, attesaErrore: 0 });
  app.push(a);
  const cookie: Record<string, string> = {};
  const id: Record<string, number> = {};
  for (const username of usernames) {
    const r = await a.inject({ method: "POST", url: "/api/registrazione", payload: { username, password: "segretissima" } });
    cookie[username] = cookieDa(r.headers["set-cookie"]);
    id[username] = r.json().id;
  }
  const chiama = (utente: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
    a.inject({ method, url, headers: { cookie: cookie[utente] }, ...(payload ? { payload } : {}) });
  const personaggio = async (utente: string, nome: string) =>
    (await chiama(utente, "POST", "/api/personaggi", { dati: alston(nome) })).json().id as number;
  // Party di `master` con il codice.
  const party = async (master: string, nome = "La Compagnia") => {
    const r = await chiama(master, "POST", "/api/party", { nome });
    expect(r.statusCode).toBe(201);
    return r.json() as { id: number; codice: string };
  };
  return { app: a, chiama, personaggio, party, id };
}

describe("party: codice", () => {
  it("il codice ha 8 caratteri senza simboli ambigui e si normalizza", () => {
    const codice = nuovoCodice();
    expect(codice).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(normalizzaCodice(" abcd-efgh ")).toBe("ABCDEFGH");
  });
});

describe("party: creazione e ingresso", () => {
  it("il Master crea il party, il giocatore entra con il codice e tutti vedono i membri", async () => {
    const { chiama, personaggio, party, id } = await tavolo("master", "giocatore");
    const { id: partyId, codice } = await party("master");
    expect(codice).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const pg = await personaggio("giocatore", "Bruenor");
    const ingresso = await chiama("giocatore", "POST", "/api/party/entra", { codice: codice.toLowerCase(), personaggioId: pg });
    expect(ingresso.statusCode).toBe(201);
    expect(ingresso.json()).toEqual({ id: partyId });

    const visto = (await chiama("giocatore", "GET", `/api/party/${partyId}`)).json() as DettaglioParty;
    expect(visto.nome).toBe("La Compagnia");
    expect(visto.codice).toBeNull(); // il codice lo vede solo il Master
    expect(visto.io).toEqual({ utenteId: id.giocatore, ruolo: "giocatore", personaggioId: pg });
    expect(visto.membri.map(m => [m.username, m.ruolo])).toEqual([["master", "master"], ["giocatore", "giocatore"]]);
    const bruenor = visto.membri[1].personaggio!;
    expect(bruenor).toMatchObject({ id: pg, nome: "Bruenor", classe: INITIAL_CHARACTER.info.classe });
    expect(bruenor.pf).toBe(INITIAL_CHARACTER.combattimento.pfAttuali);
    expect(bruenor.ca).toBeGreaterThan(0);
    expect(visto.membri[0].personaggio).toBeNull();

    const dalMaster = (await chiama("master", "GET", `/api/party/${partyId}`)).json() as DettaglioParty;
    expect(dalMaster.codice).toBe(codice);

    expect((await chiama("giocatore", "GET", "/api/party")).json()).toEqual([
      { id: partyId, nome: "La Compagnia", ruolo: "giocatore", personaggio: { id: pg, nome: "Bruenor" }, membri: 2, nonLetti: 0, combattimento: null },
    ]);
    const elenco = (await chiama("giocatore", "GET", "/api/personaggi")).json();
    expect(elenco[0].party).toEqual({ id: partyId, nome: "La Compagnia" });
  });

  it("nome non valido: 400", async () => {
    const { chiama } = await tavolo("master");
    expect((await chiama("master", "POST", "/api/party", { nome: "  " })).statusCode).toBe(400);
    expect((await chiama("master", "POST", "/api/party", { nome: "x".repeat(61) })).statusCode).toBe(400);
  });

  it("codice sbagliato o personaggio altrui: 404; personaggio già in un party o utente già membro: 409", async () => {
    const { chiama, personaggio, party } = await tavolo("master", "giocatore", "altro");
    const { codice } = await party("master");
    const { codice: secondo } = await party("altro", "Altra campagna");
    const pg = await personaggio("giocatore", "Bruenor");
    const pgAltrui = await personaggio("altro", "Drizzt");

    const sbagliato = await chiama("giocatore", "POST", "/api/party/entra", { codice: "AAAA-AAAA", personaggioId: pg });
    expect(sbagliato.statusCode).toBe(404);
    expect(sbagliato.json().errore).toMatch(/Codice/);
    expect((await chiama("giocatore", "POST", "/api/party/entra", { codice, personaggioId: pgAltrui })).statusCode).toBe(404);

    expect((await chiama("giocatore", "POST", "/api/party/entra", { codice, personaggioId: pg })).statusCode).toBe(201);
    const giaInParty = await chiama("giocatore", "POST", "/api/party/entra", { codice: secondo, personaggioId: pg });
    expect(giaInParty.statusCode).toBe(409);
    expect(giaInParty.json().errore).toMatch(/già in un party/);

    const secondoPg = await personaggio("giocatore", "Wulfgar");
    const giaMembro = await chiama("giocatore", "POST", "/api/party/entra", { codice, personaggioId: secondoPg });
    expect(giaMembro.statusCode).toBe(409);
    expect(giaMembro.json().errore).toMatch(/già parte/);
    // Con un altro personaggio può entrare in un altro party.
    expect((await chiama("giocatore", "POST", "/api/party/entra", { codice: secondo, personaggioId: secondoPg })).statusCode).toBe(201);
  });

  it("troppi tentativi di ingresso: 429", async () => {
    const { chiama, personaggio } = await tavolo("giocatore");
    const pg = await personaggio("giocatore", "Bruenor");
    for (let i = 0; i < 10; i++) {
      expect((await chiama("giocatore", "POST", "/api/party/entra", { codice: "AAAA-AAAA", personaggioId: pg })).statusCode).toBe(404);
    }
    expect((await chiama("giocatore", "POST", "/api/party/entra", { codice: "AAAA-AAAA", personaggioId: pg })).statusCode).toBe(429);
  });
});

describe("party: permessi", () => {
  it("un non membro riceve 404, un giocatore che chiede un'azione del Master 403", async () => {
    const { chiama, personaggio, party } = await tavolo("master", "giocatore", "estraneo");
    const { id: partyId, codice } = await party("master");
    const pg = await personaggio("giocatore", "Bruenor");
    await chiama("giocatore", "POST", "/api/party/entra", { codice, personaggioId: pg });

    expect((await chiama("estraneo", "GET", `/api/party/${partyId}`)).statusCode).toBe(404);
    expect((await chiama("estraneo", "PUT", `/api/party/${partyId}`, { nome: "Mio" })).statusCode).toBe(404);
    expect((await chiama("estraneo", "GET", "/api/party/abc")).statusCode).toBe(404);

    expect((await chiama("giocatore", "PUT", `/api/party/${partyId}`, { nome: "Mio" })).statusCode).toBe(403);
    expect((await chiama("giocatore", "POST", `/api/party/${partyId}/codice`)).statusCode).toBe(403);
    expect((await chiama("giocatore", "DELETE", `/api/party/${partyId}`)).statusCode).toBe(403);
    expect((await chiama("giocatore", "GET", `/api/party/${partyId}/personaggi/${pg}`)).statusCode).toBe(403);

    expect((await chiama("master", "PUT", `/api/party/${partyId}`, { nome: "I Coraggiosi" })).statusCode).toBe(204);
    expect((await chiama("giocatore", "GET", `/api/party/${partyId}`)).json().nome).toBe("I Coraggiosi");
  });

  it("il Master legge la scheda completa di un personaggio del party, non quella di altri", async () => {
    const { chiama, personaggio, party } = await tavolo("master", "giocatore");
    const { id: partyId, codice } = await party("master");
    const pg = await personaggio("giocatore", "Bruenor");
    const fuori = await personaggio("giocatore", "Wulfgar");
    await chiama("giocatore", "POST", "/api/party/entra", { codice, personaggioId: pg });

    const scheda = await chiama("master", "GET", `/api/party/${partyId}/personaggi/${pg}`);
    expect(scheda.statusCode).toBe(200);
    expect(scheda.json().info.nome).toBe("Bruenor");
    expect(scheda.json().incantesimi.length).toBe(INITIAL_CHARACTER.incantesimi.length);
    expect((await chiama("master", "GET", `/api/party/${partyId}/personaggi/${fuori}`)).statusCode).toBe(404);
  });
});

describe("party: codice rigenerato, uscita, espulsione, scioglimento", () => {
  it("il codice rigenerato sostituisce il vecchio", async () => {
    const { chiama, personaggio, party } = await tavolo("master", "giocatore");
    const { id: partyId, codice } = await party("master");
    const nuovo = (await chiama("master", "POST", `/api/party/${partyId}/codice`)).json().codice;
    expect(nuovo).not.toBe(codice);
    const pg = await personaggio("giocatore", "Bruenor");
    expect((await chiama("giocatore", "POST", "/api/party/entra", { codice, personaggioId: pg })).statusCode).toBe(404);
    expect((await chiama("giocatore", "POST", "/api/party/entra", { codice: nuovo, personaggioId: pg })).statusCode).toBe(201);
  });

  it("il giocatore esce, il Master espelle ma non esce, e scioglie il party", async () => {
    const { chiama, personaggio, party, id } = await tavolo("master", "uno", "due");
    const { id: partyId, codice } = await party("master");
    await chiama("uno", "POST", "/api/party/entra", { codice, personaggioId: await personaggio("uno", "Bruenor") });
    await chiama("due", "POST", "/api/party/entra", { codice, personaggioId: await personaggio("due", "Drizzt") });

    // Un giocatore non può espellere un altro.
    expect((await chiama("uno", "DELETE", `/api/party/${partyId}/membri/${id.due}`)).statusCode).toBe(403);
    expect((await chiama("uno", "DELETE", `/api/party/${partyId}/membri/${id.uno}`)).statusCode).toBe(204);
    expect((await chiama("uno", "GET", `/api/party/${partyId}`)).statusCode).toBe(404);

    expect((await chiama("master", "DELETE", `/api/party/${partyId}/membri/${id.master}`)).statusCode).toBe(409);
    expect((await chiama("master", "DELETE", `/api/party/${partyId}/membri/${id.due}`)).statusCode).toBe(204);
    expect((await chiama("master", "DELETE", `/api/party/${partyId}/membri/${id.due}`)).statusCode).toBe(404);
    expect((await chiama("master", "GET", `/api/party/${partyId}`)).json().membri).toHaveLength(1);

    expect((await chiama("master", "DELETE", `/api/party/${partyId}`)).statusCode).toBe(204);
    expect((await chiama("master", "GET", `/api/party/${partyId}`)).statusCode).toBe(404);
    expect((await chiama("master", "GET", "/api/party")).json()).toEqual([]);
  });
});

describe("party: chat", () => {
  // Party con il Master e due giocatori (Bruenor e Drizzt).
  async function partyConTre() {
    const t = await tavolo("master", "uno", "due");
    const { id: partyId, codice } = await t.party("master");
    await t.chiama("uno", "POST", "/api/party/entra", { codice, personaggioId: await t.personaggio("uno", "Bruenor") });
    await t.chiama("due", "POST", "/api/party/entra", { codice, personaggioId: await t.personaggio("due", "Drizzt") });
    const scrivi = (utente: string, testo: string, destinatarioId?: number) =>
      t.chiama(utente, "POST", `/api/party/${partyId}/messaggi`, { testo, ...(destinatarioId ? { destinatarioId } : {}) });
    const leggi = async (utente: string, query = "") =>
      (await t.chiama(utente, "GET", `/api/party/${partyId}/messaggi${query}`)).json() as MessaggiParty;
    const nonLetti = async (utente: string) => (await t.chiama(utente, "GET", "/api/party")).json()[0].nonLetti as number;
    return { ...t, partyId, scrivi, leggi, nonLetti };
  }

  it("i messaggi di gruppo li vedono tutti, i privati solo autore e destinatario", async () => {
    const { scrivi, leggi, id } = await partyConTre();
    expect((await scrivi("uno", "  Ciao a tutti!  ")).statusCode).toBe(201);
    expect((await scrivi("uno", "Psst, Master", id.master)).statusCode).toBe(201);
    await scrivi("master", "Benvenuti");

    const delMaster = await leggi("master");
    expect(delMaster.messaggi.map(m => [m.autore, m.testo, m.destinatarioId])).toEqual([
      ["Bruenor", "Ciao a tutti!", null], ["Bruenor", "Psst, Master", id.master], ["Master", "Benvenuti", null],
    ]);
    expect(delMaster.messaggi[0]).toMatchObject({ autoreId: id.uno, ruoloAutore: "giocatore", tipo: "testo", tiro: null });
    expect((await leggi("uno")).messaggi).toHaveLength(3);
    expect((await leggi("due")).messaggi.map(m => m.testo)).toEqual(["Ciao a tutti!", "Benvenuti"]);
  });

  it("messaggi non validi: testo vuoto o troppo lungo, destinatario fuori dal party o sé stessi", async () => {
    const { scrivi, chiama, id, partyId } = await partyConTre();
    expect((await scrivi("uno", "   ")).statusCode).toBe(400);
    expect((await scrivi("uno", "x".repeat(2001))).statusCode).toBe(400);
    expect((await scrivi("uno", "a me", id.uno)).statusCode).toBe(400);
    expect((await scrivi("uno", "a nessuno", 999_999)).statusCode).toBe(400);
    expect((await chiama("uno", "GET", `/api/party/${partyId}/messaggi?dopo=abc`)).statusCode).toBe(400);
  });

  it("dopo e prima scorrono i messaggi; senza cursore arrivano gli ultimi 100", async () => {
    const { leggi, app: a, partyId, id } = await partyConTre();
    const db = (a as FastifyInstance).db;
    await db.query(
      "INSERT INTO party_messaggi (party_id, autore_id, testo) SELECT $1, $2, 'n' || g FROM generate_series(1, 120) g",
      [partyId, id.uno]);
    const ultimi = await leggi("due");
    expect(ultimi.messaggi).toHaveLength(100);
    expect(ultimi.messaggi.at(-1)!.testo).toBe("n120");
    const primo = ultimi.messaggi[0];
    expect(primo.testo).toBe("n21");
    const precedenti = await leggi("due", `?prima=${primo.id}`);
    expect(precedenti.messaggi.map(m => m.testo)).toEqual(Array.from({ length: 20 }, (_, i) => `n${i + 1}`));
    const nuovi = await leggi("due", `?dopo=${ultimi.messaggi.at(-2)!.id}`);
    expect(nuovi.messaggi.map(m => m.testo)).toEqual(["n120"]);
  });

  it("i non letti contano gruppo e privati ricevuti, non i propri; si azzerano per conversazione", async () => {
    const { scrivi, leggi, nonLetti, chiama, partyId, id } = await partyConTre();
    await scrivi("uno", "Ciao");
    await scrivi("uno", "Solo per te", id.due);
    await scrivi("uno", "Per il Master", id.master);
    expect(await nonLetti("uno")).toBe(0);
    expect(await nonLetti("due")).toBe(2);
    expect(await nonLetti("master")).toBe(2);

    const messaggi = (await leggi("due")).messaggi;
    const gruppo = messaggi.find(m => m.destinatarioId === null)!.id;
    expect((await chiama("due", "PUT", `/api/party/${partyId}/letto`, { con: 0, fino: gruppo })).statusCode).toBe(204);
    expect(await nonLetti("due")).toBe(1); // il privato resta da leggere
    const privato = messaggi.find(m => m.destinatarioId === id.due)!.id;
    await chiama("due", "PUT", `/api/party/${partyId}/letto`, { con: id.uno, fino: privato });
    expect(await nonLetti("due")).toBe(0);
    // Non si torna indietro.
    await chiama("due", "PUT", `/api/party/${partyId}/letto`, { con: 0, fino: 0 });
    expect((await leggi("due")).letture).toEqual({ 0: gruppo, [id.uno]: privato });
    expect((await chiama("due", "PUT", `/api/party/${partyId}/letto`, { con: -1, fino: 1 })).statusCode).toBe(400);
  });

  it("tiri condivisi: al gruppo o segreti al Master; un tiro malformato è rifiutato", async () => {
    const { chiama, leggi, partyId, id } = await partyConTre();
    const tiro = {
      titolo: "Attacco: Ascia", dadi: [{ etichetta: "1° d20", facce: 20 }, { etichetta: "2° d20", facce: 20 }],
      tiri: [7, 16], modalita: "vantaggio", bonus: 5, totale: 21, extra: "ignorato",
    };
    const url = `/api/party/${partyId}/messaggi`;
    expect((await chiama("uno", "POST", url, { tiro })).statusCode).toBe(201);
    expect((await chiama("uno", "POST", url, { tiro: { ...tiro, titolo: "Inganno" }, segreto: true })).statusCode).toBe(201);

    const visti = (await leggi("due")).messaggi;
    expect(visti).toHaveLength(1);
    expect(visti[0]).toMatchObject({ tipo: "tiro", testo: "", destinatarioId: null });
    expect(visti[0].tiro).toEqual({
      titolo: "Attacco: Ascia", dadi: tiro.dadi, tiri: [7, 16], modalita: "vantaggio", bonus: 5, totale: 21,
    });
    const delMaster = (await leggi("master")).messaggi;
    expect(delMaster.map(m => [m.tiro?.titolo, m.destinatarioId])).toEqual([["Attacco: Ascia", null], ["Inganno", id.master]]);

    for (const sbagliato of [
      { ...tiro, tiri: [] }, { ...tiro, tiri: [1.5] }, { ...tiro, modalita: "doppio" }, { ...tiro, titolo: "" },
      { ...tiro, dadi: Array.from({ length: 41 }, () => ({ etichetta: "d6", facce: 6 })) }, "tiro",
    ]) {
      expect((await chiama("uno", "POST", url, { tiro: sbagliato })).statusCode).toBe(400);
    }
    expect((await chiama("master", "POST", url, { tiro, segreto: true })).statusCode).toBe(400);
  });

  it("chi esce dal party non legge né scrive più; i suoi messaggi restano con lo username", async () => {
    const { scrivi, leggi, chiama, partyId, id } = await partyConTre();
    await scrivi("uno", "Me ne vado");
    await chiama("uno", "DELETE", `/api/party/${partyId}/membri/${id.uno}`);
    expect((await chiama("uno", "GET", `/api/party/${partyId}/messaggi`)).statusCode).toBe(404);
    expect((await scrivi("uno", "Ci sono ancora?")).statusCode).toBe(404);
    expect((await leggi("due")).messaggi[0]).toMatchObject({ autore: "uno", ruoloAutore: null });
  });
});

describe("party: mostri nell'iniziativa", () => {
  it("CA, PF, condizioni e note li vede solo il Master; i giocatori vedono nome e stato di salute", async () => {
    const t = await tavolo("master", "uno");
    const { id: partyId, codice } = await t.party("master");
    const bruenor = await t.personaggio("uno", "Bruenor");
    await t.chiama("uno", "POST", "/api/party/entra", { codice, personaggioId: bruenor });
    const url = `/api/party/${partyId}/combattimento`;
    await t.chiama("master", "POST", url);
    await t.chiama("uno", "PUT", `${url}/mio`, { valore: 10 });
    const goblin = (await t.chiama("master", "POST", `${url}/voci`, {
      nome: "Goblin", valore: 15, bonus: 2, ca: 15, pfMassimi: 7, condizioni: ["prono"], note: "Scimitarra +4, 1d6+2",
    })).json().id;
    const stato = async (utente: string) => (await t.chiama(utente, "GET", url)).json() as Combattimento;

    expect((await stato("master")).voci[0]).toMatchObject({
      nome: "Goblin", ca: 15, pf: 7, pfMassimi: 7, condizioni: ["prono"], note: "Scimitarra +4, 1d6+2", stato: "illeso",
    });
    expect((await stato("uno")).voci[0]).toEqual({
      id: goblin, personaggioId: null, nome: "Goblin", valore: 15, bonus: 2, nascosto: false,
      ca: null, pf: null, pfMassimi: null, condizioni: [], note: "", stato: "illeso",
    });

    // Danno e cura: i PF restano tra 0 e i massimi.
    await t.chiama("master", "PUT", `${url}/voci/${goblin}`, { pf: 3 });
    expect((await stato("uno")).voci[0].stato).toBe("gravemente ferito");
    await t.chiama("master", "PUT", `${url}/voci/${goblin}`, { pf: 50 });
    expect((await stato("master")).voci[0].pf).toBe(7);
    await t.chiama("master", "PUT", `${url}/voci/${goblin}`, { condizioni: ["prono", "avvelenato", "prono"] });
    expect((await stato("master")).voci[0].condizioni).toEqual(["prono", "avvelenato"]);

    expect((await t.chiama("master", "PUT", `${url}/voci/${goblin}`, { condizioni: ["felice"] })).statusCode).toBe(400);
    expect((await t.chiama("master", "PUT", `${url}/voci/${goblin}`, { ca: 99 })).statusCode).toBe(400);
    expect((await t.chiama("uno", "PUT", `${url}/voci/${goblin}`, { pf: 0 })).statusCode).toBe(403);
    const mia = (await stato("master")).voci.find(v => v.personaggioId === bruenor)!;
    expect((await t.chiama("master", "PUT", `${url}/voci/${mia.id}`, { pf: 1 })).statusCode).toBe(400);
    expect((await t.chiama("master", "PUT", `${url}/voci/${mia.id}`, { valore: 12 })).statusCode).toBe(204);
  });

  it("un mostro a 0 PF è sconfitto e il turno lo salta", async () => {
    const t = await tavolo("master", "uno");
    const { id: partyId, codice } = await t.party("master");
    await t.chiama("uno", "POST", "/api/party/entra", { codice, personaggioId: await t.personaggio("uno", "Bruenor") });
    const url = `/api/party/${partyId}/combattimento`;
    await t.chiama("master", "POST", url);
    await t.chiama("uno", "PUT", `${url}/mio`, { valore: 10 });
    const orco = (await t.chiama("master", "POST", `${url}/voci`, { nome: "Orco", valore: 20, pfMassimi: 15 })).json().id;
    await t.chiama("master", "POST", `${url}/voci`, { nome: "Lupo", valore: 5, pfMassimi: 11 });
    const turno = async () => {
      const c = (await t.chiama("uno", "GET", url)).json() as Combattimento;
      return [c.voci.find(v => v.id === c.diTurno)?.nome, c.round];
    };
    await t.chiama("master", "POST", `${url}/avanza`, { direzione: 1 });
    expect(await turno()).toEqual(["Orco", 1]);
    await t.chiama("master", "PUT", `${url}/voci/${orco}`, { pf: 0 });
    expect((await t.chiama("uno", "GET", url)).json().voci[0].stato).toBe("sconfitto");
    await t.chiama("master", "POST", `${url}/avanza`, { direzione: 1 });
    await t.chiama("master", "POST", `${url}/avanza`, { direzione: 1 });
    expect(await turno()).toEqual(["Lupo", 1]);
    await t.chiama("master", "POST", `${url}/avanza`, { direzione: 1 });
    expect(await turno()).toEqual(["Bruenor", 2]); // l'Orco sconfitto non torna di turno
  });
});

describe("party: diario", () => {
  async function partyConDiario() {
    const t = await tavolo("master", "uno", "due");
    const { id: partyId, codice } = await t.party("master");
    await t.chiama("uno", "POST", "/api/party/entra", { codice, personaggioId: await t.personaggio("uno", "Bruenor") });
    await t.chiama("due", "POST", "/api/party/entra", { codice, personaggioId: await t.personaggio("due", "Drizzt") });
    const url = `/api/party/${partyId}/diario`;
    const voce = { titolo: "Sessione 1", testo: "Arrivo a Phandalin", categoria: "sessione" };
    return { ...t, partyId, url, voce };
  }

  it("tutti scrivono e leggono; le voci fissate (solo dal Master) vengono prima", async () => {
    const { chiama, url, voce, partyId } = await partyConDiario();
    const prima = await chiama("uno", "POST", url, voce);
    expect(prima.statusCode).toBe(201);
    expect(prima.json()).toMatchObject({ ...voce, fissata: false, autore: "Bruenor", aggiornatoDa: "Bruenor", revisione: 1 });
    expect((await chiama("uno", "POST", url, { ...voce, fissata: true })).statusCode).toBe(403);
    const fissata = await chiama("master", "POST", url, { titolo: "Regole della casa", testo: "", categoria: "altro", fissata: true });
    expect(fissata.json()).toMatchObject({ fissata: true, autore: "Master" });
    await chiama("due", "POST", url, { titolo: "Sildar", testo: "Cavaliere", categoria: "png" });

    expect((await chiama("due", "GET", url)).json().map((v: VoceDiario) => v.titolo)).toEqual(["Regole della casa", "Sildar", "Sessione 1"]);
    const versione = (await chiama("uno", "GET", `/api/party/${partyId}`)).json().diarioVersione;
    expect(versione).toMatch(/^3:/);
  });

  it("voci non valide: 400", async () => {
    const { chiama, url, voce } = await partyConDiario();
    expect((await chiama("uno", "POST", url, { ...voce, titolo: " " })).statusCode).toBe(400);
    expect((await chiama("uno", "POST", url, { ...voce, categoria: "mostro" })).statusCode).toBe(400);
    expect((await chiama("uno", "POST", url, { ...voce, testo: "x".repeat(20_001) })).statusCode).toBe(400);
  });

  it("la modifica usa la revisione: 409 con la versione attuale; solo il Master cambia la fissata", async () => {
    const { chiama, url, voce } = await partyConDiario();
    const creata = (await chiama("uno", "POST", url, voce)).json() as VoceDiario;
    const modificata = await chiama("due", "PUT", `${url}/${creata.id}`, { ...voce, testo: "Goblin sulla strada", revisione: 1 });
    expect(modificata.statusCode).toBe(200);
    expect(modificata.json()).toMatchObject({ testo: "Goblin sulla strada", revisione: 2, autore: "Bruenor", aggiornatoDa: "Drizzt" });

    const tardiva = await chiama("uno", "PUT", `${url}/${creata.id}`, { ...voce, testo: "Versione vecchia", revisione: 1 });
    expect(tardiva.statusCode).toBe(409);
    expect(tardiva.json()).toMatchObject({ testo: "Goblin sulla strada", revisione: 2 });

    expect((await chiama("uno", "PUT", `${url}/${creata.id}`, { ...voce, fissata: true, revisione: 2 })).statusCode).toBe(403);
    // La stessa fissata (nessun cambiamento) va bene anche per un giocatore.
    expect((await chiama("uno", "PUT", `${url}/${creata.id}`, { ...voce, fissata: false, revisione: 2 })).statusCode).toBe(200);
    expect((await chiama("master", "PUT", `${url}/${creata.id}`, { ...voce, fissata: true, revisione: 3 })).json().fissata).toBe(true);
    expect((await chiama("uno", "PUT", `${url}/999`, { ...voce, revisione: 1 })).statusCode).toBe(404);
  });

  it("la cancella solo chi l'ha scritta o il Master; i non membri ricevono 404", async () => {
    const { chiama, url, voce, app: a } = await partyConDiario();
    const creata = (await chiama("uno", "POST", url, voce)).json() as VoceDiario;
    const altra = (await chiama("uno", "POST", url, { ...voce, titolo: "Sessione 2" })).json() as VoceDiario;
    expect((await chiama("due", "DELETE", `${url}/${creata.id}`)).statusCode).toBe(403);
    expect((await chiama("uno", "DELETE", `${url}/${creata.id}`)).statusCode).toBe(204);
    expect((await chiama("master", "DELETE", `${url}/${altra.id}`)).statusCode).toBe(204);
    expect((await chiama("master", "DELETE", `${url}/${altra.id}`)).statusCode).toBe(404);

    const r = await a.inject({ method: "POST", url: "/api/registrazione", payload: { username: "estraneo", password: "segretissima" } });
    const estraneo = cookieDa(r.headers["set-cookie"]);
    expect((await a.inject({ method: "GET", url, headers: { cookie: estraneo } })).statusCode).toBe(404);
  });
});

describe("party: iniziativa", () => {
  async function scontro() {
    const t = await tavolo("master", "uno", "due");
    const { id: partyId, codice } = await t.party("master");
    const bruenor = await t.personaggio("uno", "Bruenor");
    await t.chiama("uno", "POST", "/api/party/entra", { codice, personaggioId: bruenor });
    await t.chiama("due", "POST", "/api/party/entra", { codice, personaggioId: await t.personaggio("due", "Drizzt") });
    const url = `/api/party/${partyId}/combattimento`;
    const stato = async (utente: string) => (await t.chiama(utente, "GET", url)).json() as Combattimento;
    return { ...t, partyId, url, stato, bruenor };
  }

  it("il Master avvia, i giocatori inseriscono l'iniziativa (bonus dalla scheda), le voci nascoste le vede solo il Master", async () => {
    const { chiama, url, stato, bruenor } = await scontro();
    expect(await stato("uno")).toEqual({ attivo: false, round: 0, diTurno: null, voci: [] });
    expect((await chiama("uno", "PUT", `${url}/mio`, { valore: 14 })).statusCode).toBe(409); // nessuno scontro
    expect((await chiama("uno", "POST", url)).statusCode).toBe(403);
    expect((await chiama("master", "POST", url)).statusCode).toBe(204);

    expect((await chiama("uno", "PUT", `${url}/mio`, { valore: 14 })).statusCode).toBe(204);
    expect((await chiama("due", "PUT", `${url}/mio`, { valore: 9 })).statusCode).toBe(204);
    expect((await chiama("uno", "PUT", `${url}/mio`, { valore: 16 })).statusCode).toBe(204); // si può correggere
    expect((await chiama("master", "PUT", `${url}/mio`, { valore: 16 })).statusCode).toBe(400);
    expect((await chiama("master", "POST", `${url}/voci`, { nome: "Goblin", valore: 12, bonus: 2 })).statusCode).toBe(201);
    expect((await chiama("master", "POST", `${url}/voci`, { nome: "Assassino", valore: 20, nascosto: true })).statusCode).toBe(201);
    expect((await chiama("uno", "POST", `${url}/voci`, { nome: "Drago", valore: 30 })).statusCode).toBe(403);
    expect((await chiama("master", "POST", `${url}/voci`, { nome: "", valore: 30 })).statusCode).toBe(400);

    const master = await stato("master");
    expect(master.voci.map(v => [v.nome, v.valore])).toEqual([["Assassino", 20], ["Bruenor", 16], ["Goblin", 12], ["Drizzt", 9]]);
    const desDiAlston = Math.floor((INITIAL_CHARACTER.caratteristiche.DES.valore - 10) / 2);
    expect(master.voci[1]).toMatchObject({ personaggioId: bruenor, bonus: desDiAlston });
    expect((await stato("due")).voci.map(v => v.nome)).toEqual(["Bruenor", "Goblin", "Drizzt"]);
  });

  it("il Master avanza i turni e i round; tuoTurno compare nell'elenco dei party; termina cancella tutto", async () => {
    const { chiama, url, stato } = await scontro();
    await chiama("master", "POST", url);
    await chiama("uno", "PUT", `${url}/mio`, { valore: 15 });
    await chiama("due", "PUT", `${url}/mio`, { valore: 10 });
    const nascosto = (await chiama("master", "POST", `${url}/voci`, { nome: "Ombra", valore: 5, nascosto: true })).json().id;

    expect((await chiama("uno", "POST", `${url}/avanza`, { direzione: 1 })).statusCode).toBe(403);
    expect((await chiama("master", "POST", `${url}/avanza`, { direzione: 2 })).statusCode).toBe(400);
    await chiama("master", "POST", `${url}/avanza`, { direzione: 1 });
    const primo = await stato("uno");
    expect(primo.voci.find(v => v.id === primo.diTurno)?.nome).toBe("Bruenor");
    expect((await chiama("uno", "GET", "/api/party")).json()[0].combattimento).toEqual({ round: 1, tuoTurno: true });
    expect((await chiama("due", "GET", "/api/party")).json()[0].combattimento).toEqual({ round: 1, tuoTurno: false });

    await chiama("master", "POST", `${url}/avanza`, { direzione: 1 }); // Drizzt
    await chiama("master", "POST", `${url}/avanza`, { direzione: 1 }); // Ombra (nascosta)
    expect((await stato("uno")).diTurno).toBeNull(); // i giocatori non vedono di chi è il turno
    expect((await stato("master")).diTurno).toBe(nascosto);
    await chiama("master", "POST", `${url}/avanza`, { direzione: 1 });
    expect(await stato("due")).toMatchObject({ round: 2 });

    // Il Master mostra la voce nascosta e la toglie.
    expect((await chiama("master", "PUT", `${url}/voci/${nascosto}`, { nascosto: false })).statusCode).toBe(204);
    expect((await stato("uno")).voci.map(v => v.nome)).toContain("Ombra");
    expect((await chiama("master", "DELETE", `${url}/voci/${nascosto}`)).statusCode).toBe(204);
    expect((await chiama("master", "DELETE", `${url}/voci/${nascosto}`)).statusCode).toBe(404);

    expect((await chiama("master", "DELETE", url)).statusCode).toBe(204);
    expect((await stato("uno")).attivo).toBe(false);
    expect((await chiama("uno", "GET", "/api/party")).json()[0].combattimento).toBeNull();
    // Un nuovo scontro parte senza le voci del precedente.
    await chiama("master", "POST", url);
    expect((await stato("master")).voci).toEqual([]);
  });
});

describe("party: tesoro", () => {
  async function conTesoro() {
    const t = await tavolo("master", "uno", "due");
    const { id: partyId, codice } = await t.party("master");
    await t.chiama("uno", "POST", "/api/party/entra", { codice, personaggioId: await t.personaggio("uno", "Bruenor") });
    await t.chiama("due", "POST", "/api/party/entra", { codice, personaggioId: await t.personaggio("due", "Drizzt") });
    const url = `/api/party/${partyId}/tesoro`;
    const tesoro = async (utente = "uno") => (await t.chiama(utente, "GET", url)).json() as Tesoro;
    return { ...t, url, tesoro };
  }

  it("le monete si mettono e si prendono senza mai scendere sotto zero", async () => {
    const { chiama, url, tesoro } = await conTesoro();
    expect((await tesoro()).monete).toEqual({ mr: 0, ma: 0, me: 0, mo: 0, mp: 0 });
    expect((await chiama("uno", "POST", `${url}/monete`, { delta: { mo: 10, ma: 5 } })).json()).toEqual({ mr: 0, ma: 5, me: 0, mo: 10, mp: 0 });
    const troppe = await chiama("due", "POST", `${url}/monete`, { delta: { mo: -11 } });
    expect(troppe.statusCode).toBe(409);
    expect((await tesoro()).monete.mo).toBe(10);
    expect((await chiama("due", "POST", `${url}/monete`, { delta: { mo: -4 } })).json().mo).toBe(6);
    // Due prelievi contemporanei: uno solo va a buon fine.
    const [a, b] = await Promise.all([
      chiama("uno", "POST", `${url}/monete`, { delta: { mo: -6 } }),
      chiama("due", "POST", `${url}/monete`, { delta: { mo: -6 } }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    expect((await tesoro()).monete.mo).toBe(0);

    for (const delta of [{}, { mo: 1, ma: -1 }, { oro: 3 }, { mo: 1.5 }, "10"]) {
      expect((await chiama("uno", "POST", `${url}/monete`, { delta })).statusCode).toBe(400);
    }
  });

  it("gli oggetti uguali si sommano; prendere ne toglie, il secondo che prende l'ultimo riceve 404", async () => {
    const { chiama, url, tesoro } = await conTesoro();
    const pozione = { nome: "Pozione di guarigione", qta: 2, peso: 0.25 };
    const id = (await chiama("uno", "POST", `${url}/oggetti`, pozione)).json().id;
    expect((await chiama("due", "POST", `${url}/oggetti`, { ...pozione, nome: "pozione di guarigione", qta: 1 })).json().id).toBe(id);
    await chiama("master", "POST", `${url}/oggetti`, { nome: "Razioni (1 giorno)", qta: 5, peso: 1, consumabile: true, consumoGiornaliero: 1 });
    expect((await tesoro()).oggetti.map(o => [o.nome, o.qta])).toEqual([["Pozione di guarigione", 3], ["Razioni (1 giorno)", 5]]);

    const presa = await chiama("due", "POST", `${url}/oggetti/${id}/prendi`, { qta: 2 });
    expect(presa.json()).toEqual({ nome: "Pozione di guarigione", qta: 2, peso: 0.25 });
    expect((await chiama("uno", "POST", `${url}/oggetti/${id}/prendi`, { qta: 2 })).statusCode).toBe(409);
    expect((await chiama("uno", "POST", `${url}/oggetti/${id}/prendi`, { qta: 1 })).statusCode).toBe(200);
    expect((await chiama("due", "POST", `${url}/oggetti/${id}/prendi`, { qta: 1 })).statusCode).toBe(404);
    expect((await chiama("uno", "POST", `${url}/oggetti`, { nome: "", qta: 1 })).statusCode).toBe(400);
    expect((await chiama("uno", "POST", `${url}/oggetti`, { nome: "Sasso", qta: 0 })).statusCode).toBe(400);
  });

  it("il Master toglie un oggetto; lo storico dice chi ha fatto cosa, dal più recente", async () => {
    const { chiama, url, tesoro } = await conTesoro();
    await chiama("master", "POST", `${url}/oggetti`, { nome: "Gemma", qta: 1, peso: 0 });
    await chiama("uno", "POST", `${url}/monete`, { delta: { mo: 20 } });
    const gemma = (await tesoro()).oggetti[0].id;
    expect((await chiama("uno", "DELETE", `${url}/oggetti/${gemma}`)).statusCode).toBe(403);
    expect((await chiama("master", "DELETE", `${url}/oggetti/${gemma}`)).statusCode).toBe(204);
    expect((await tesoro()).movimenti.map(m => `${m.chi} ${m.descrizione}`)).toEqual([
      "Master ha tolto 1× Gemma", "Bruenor ha messo 20 mo", "Master ha messo nel bottino 1× Gemma",
    ]);
  });

  it("gli oggetti del party stanno negli Zaini: il tesoro li mostra per chi li porta; prendere dice per chi", async () => {
    const { chiama, url, tesoro } = await conTesoro();
    const corda = (await chiama("master", "POST", `${url}/oggetti`, { nome: "Corda", qta: 1, peso: 5 })).json().id;
    await chiama("master", "POST", `${url}/oggetti`, { nome: "Gemma", qta: 2, peso: 0 });
    const gemma = (await tesoro()).oggetti.find(o => o.nome === "Gemma")!.id;
    expect((await chiama("uno", "POST", `${url}/oggetti/${corda}/prendi`, { qta: 1, delParty: true })).statusCode).toBe(200);
    expect((await chiama("due", "POST", `${url}/oggetti/${gemma}/prendi`, { qta: 1 })).statusCode).toBe(200);

    // Il client mette l'oggetto nello Zaino (con delParty) e salva la scheda.
    const elenco = (await chiama("uno", "GET", "/api/personaggi")).json();
    const pid = elenco[0].id as number;
    const { dati, revisione } = (await chiama("uno", "GET", `/api/personaggi/${pid}`)).json();
    dati.inventario = [{ id: 501, nome: "Corda", qta: 1, peso: 5, delParty: true }, { id: 502, nome: "Mappa", qta: 1, peso: 0 }];
    expect((await chiama("uno", "PUT", `/api/personaggi/${pid}`, { dati, revisione })).statusCode).toBe(200);

    const t = await tesoro("due");
    expect(t.portati).toEqual([{ personaggioId: pid, nome: "Bruenor", oggetti: [{ id: 501, nome: "Corda", qta: 1, peso: 5 }] }]);
    expect(t.oggetti.map(o => [o.nome, o.qta])).toEqual([["Gemma", 1]]);
    expect(t.movimenti.slice(0, 2).map(m => `${m.chi} ${m.descrizione}`)).toEqual([
      "Drizzt ha preso 1× Gemma per sé", "Bruenor ha preso 1× Corda per il party",
    ]);
  });
});

describe("componiMolti", () => {
  it("compone più schede con una sola query", async () => {
    const db = await archivioDiProva();
    const utente = (await creaUtente(db, "prova", "segretissima"))!;
    const a = await creaPersonaggio(db, utente.id, alston("Uno"));
    const b = await creaPersonaggio(db, utente.id, alston("Due"));
    const schede = await componiMolti(db, [a, b, 999_999]);
    expect([...schede.keys()].sort()).toEqual([a, b].sort());
    expect(schede.get(b)?.info.nome).toBe("Due");
    expect((await componiMolti(db, [])).size).toBe(0);
  });
});
