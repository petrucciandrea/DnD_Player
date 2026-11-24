import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "@dnd/regole/dati/alston.ts";
import type { DettaglioParty, MessaggiParty } from "@dnd/regole/api.ts";
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
      { id: partyId, nome: "La Compagnia", ruolo: "giocatore", personaggio: { id: pg, nome: "Bruenor" }, membri: 2, nonLetti: 0 },
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

  it("chi esce dal party non legge né scrive più; i suoi messaggi restano con lo username", async () => {
    const { scrivi, leggi, chiama, partyId, id } = await partyConTre();
    await scrivi("uno", "Me ne vado");
    await chiama("uno", "DELETE", `/api/party/${partyId}/membri/${id.uno}`);
    expect((await chiama("uno", "GET", `/api/party/${partyId}/messaggi`)).statusCode).toBe(404);
    expect((await scrivi("uno", "Ci sono ancora?")).statusCode).toBe(404);
    expect((await leggi("due")).messaggi[0]).toMatchObject({ autore: "uno", ruoloAutore: null });
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
