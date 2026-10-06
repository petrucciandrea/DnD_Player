import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { INITIAL_CHARACTER } from "@dnd/regole/dati/alston.ts";
import { costruisciApp } from "../src/app.ts";
import { archivioDiProva } from "./database.ts";

const app: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(app.splice(0).map(a => a.close()));
});

const nuovaApp = async (produzione = false) => {
  const a = await costruisciApp({ db: await archivioDiProva(), produzione, attesaErrore: 0 });
  app.push(a);
  return a;
};

const cookieDa = (intestazione: string | string[] | number | undefined) =>
  String(Array.isArray(intestazione) ? intestazione[0] : intestazione).split(";")[0];

// App con un utente registrato e il suo cookie di sessione.
const conUtente = async (username = "prova", produzione = false) => {
  const a = await nuovaApp(produzione);
  const r = await a.inject({ method: "POST", url: "/api/registrazione", payload: { username, password: "segretissima" } });
  return { app: a, registrazione: r, cookie: cookieDa(r.headers["set-cookie"]) };
};

const alston = () => structuredClone(INITIAL_CHARACTER);

describe("api: accesso", () => {
  it("la registrazione crea l'utente e apre la sessione con un cookie HttpOnly e SameSite=Strict", async () => {
    const { app: a, registrazione, cookie } = await conUtente();
    expect(registrazione.statusCode).toBe(201);
    expect(registrazione.json()).toMatchObject({ username: "prova" });
    expect(String(registrazione.headers["set-cookie"])).toMatch(/HttpOnly/);
    expect(String(registrazione.headers["set-cookie"])).toMatch(/SameSite=Strict/);
    expect(String(registrazione.headers["set-cookie"])).not.toMatch(/Secure/);
    const sessione = await a.inject({ method: "GET", url: "/api/sessione", headers: { cookie } });
    expect(sessione.json()).toMatchObject({ username: "prova" });
  });

  it("in produzione il cookie è Secure", async () => {
    const { registrazione } = await conUtente("prova", true);
    expect(String(registrazione.headers["set-cookie"])).toMatch(/Secure/);
  });

  it("registrazioni non valide o doppie: 400 e 409 con il messaggio", async () => {
    const { app: a } = await conUtente();
    const corta = await a.inject({ method: "POST", url: "/api/registrazione", payload: { username: "ab", password: "segretissima" } });
    expect(corta.statusCode).toBe(400);
    expect(corta.json().errore).toMatch(/username/);
    const doppia = await a.inject({ method: "POST", url: "/api/registrazione", payload: { username: "PROVA", password: "segretissima" } });
    expect(doppia.statusCode).toBe(409);
    const senzaCampi = await a.inject({ method: "POST", url: "/api/registrazione", payload: {} });
    expect(senzaCampi.json()).toEqual({ errore: "Servono username e password" });
  });

  it("accesso: 200 con il cookie, 401 con la password sbagliata", async () => {
    const { app: a } = await conUtente();
    const giusto = await a.inject({ method: "POST", url: "/api/accesso", payload: { username: "Prova", password: "segretissima" } });
    expect(giusto.statusCode).toBe(200);
    expect(cookieDa(giusto.headers["set-cookie"])).toMatch(/^dnd_sessione=/);
    const sbagliato = await a.inject({ method: "POST", url: "/api/accesso", payload: { username: "prova", password: "sbagliata" } });
    expect(sbagliato.statusCode).toBe(401);
  });

  it("dopo troppi tentativi sullo stesso username risponde 429", async () => {
    const { app: a } = await conUtente();
    const tentativo = () => a.inject({ method: "POST", url: "/api/accesso", payload: { username: "prova", password: "sbagliata" } });
    for (let i = 0; i < 10; i++) expect((await tentativo()).statusCode).toBe(401);
    const bloccato = await tentativo();
    expect(bloccato.statusCode).toBe(429);
    expect(bloccato.json().errore).toMatch(/Troppi tentativi/);
    // Un altro username non è bloccato.
    const altro = await a.inject({ method: "POST", url: "/api/accesso", payload: { username: "altro", password: "sbagliata" } });
    expect(altro.statusCode).toBe(401);
  });

  it("senza sessione tutto il resto risponde 401", async () => {
    const a = await nuovaApp();
    for (const url of ["/api/sessione", "/api/personaggi", "/api/incantesimi", "/api/creazione", "/api/personaggi/1"]) {
      expect((await a.inject({ method: "GET", url })).statusCode, url).toBe(401);
    }
    expect((await a.inject({ method: "GET", url: "/api/sessione", headers: { cookie: "dnd_sessione=inventato" } })).statusCode).toBe(401);
  });

  it("l'uscita chiude la sessione", async () => {
    const { app: a, cookie } = await conUtente();
    expect((await a.inject({ method: "POST", url: "/api/uscita", headers: { cookie } })).statusCode).toBe(204);
    expect((await a.inject({ method: "GET", url: "/api/sessione", headers: { cookie } })).statusCode).toBe(401);
  });

  it("cambio di password: 403 con quella attuale sbagliata, poi chiude le altre sessioni", async () => {
    const { app: a, cookie } = await conUtente();
    const altroDispositivo = cookieDa((await a.inject({
      method: "POST", url: "/api/accesso", payload: { username: "prova", password: "segretissima" },
    })).headers["set-cookie"]);
    const sbagliata = await a.inject({
      method: "PUT", url: "/api/account/password", headers: { cookie }, payload: { attuale: "no", nuova: "nuova-password" },
    });
    expect(sbagliata.statusCode).toBe(403);
    const giusta = await a.inject({
      method: "PUT", url: "/api/account/password", headers: { cookie }, payload: { attuale: "segretissima", nuova: "nuova-password" },
    });
    expect(giusta.statusCode).toBe(204);
    expect((await a.inject({ method: "GET", url: "/api/sessione", headers: { cookie } })).statusCode).toBe(200);
    expect((await a.inject({ method: "GET", url: "/api/sessione", headers: { cookie: altroDispositivo } })).statusCode).toBe(401);
  });

  it("cambio di username con la password attuale", async () => {
    const { app: a, cookie } = await conUtente();
    const r = await a.inject({
      method: "PUT", url: "/api/account/username", headers: { cookie }, payload: { username: "Nuovo.Nome", password: "segretissima" },
    });
    expect(r.json()).toMatchObject({ username: "nuovo.nome" });
  });
});

describe("api: personaggi", () => {
  it("crea, elenca, legge e salva con la revisione", async () => {
    const { app: a, cookie } = await conUtente();
    const creato = await a.inject({ method: "POST", url: "/api/personaggi", headers: { cookie }, payload: { dati: alston() } });
    expect(creato.statusCode).toBe(201);
    const { id } = creato.json();
    expect((await a.inject({ method: "GET", url: "/api/personaggi", headers: { cookie } })).json()).toMatchObject([{ id, nome: "Alston il Breve" }]);

    const letto = (await a.inject({ method: "GET", url: `/api/personaggi/${id}`, headers: { cookie } })).json();
    expect(letto.revisione).toBe(1);
    const dati = { ...letto.dati, combattimento: { ...letto.dati.combattimento, pfAttuali: 4 } };
    const salvato = await a.inject({ method: "PUT", url: `/api/personaggi/${id}`, headers: { cookie }, payload: { dati, revisione: 1 } });
    expect(salvato.json()).toEqual({ revisione: 2 });

    // Un secondo dispositivo con la revisione vecchia riceve 409 e la versione attuale.
    const conflitto = await a.inject({ method: "PUT", url: `/api/personaggi/${id}`, headers: { cookie }, payload: { dati: letto.dati, revisione: 1 } });
    expect(conflitto.statusCode).toBe(409);
    expect(conflitto.json()).toMatchObject({ revisione: 2, dati: { combattimento: { pfAttuali: 4 } } });
  });

  it("i campi che il client non invia restano quelli salvati", async () => {
    const { app: a, cookie } = await conUtente();
    const { id } = (await a.inject({ method: "POST", url: "/api/personaggi", headers: { cookie }, payload: { dati: alston() } })).json();
    const senzaNote: Partial<ReturnType<typeof alston>> = alston();
    delete senzaNote.note;
    const conNote = { ...alston(), note: [{ id: 1, data: "oggi", categoria: "altro", titolo: "Promemoria", testo: "", fatto: false, campi: {} }] };
    await a.inject({ method: "PUT", url: `/api/personaggi/${id}`, headers: { cookie }, payload: { dati: conNote, revisione: 1 } });
    await a.inject({ method: "PUT", url: `/api/personaggi/${id}`, headers: { cookie }, payload: { dati: senzaNote, revisione: 2 } });
    const letto = (await a.inject({ method: "GET", url: `/api/personaggi/${id}`, headers: { cookie } })).json();
    expect(letto.dati.note.map((n: { titolo: string }) => n.titolo)).toEqual(["Promemoria"]);
  });

  it("il personaggio di un altro utente risponde 404, come se non esistesse", async () => {
    const { app: a, cookie } = await conUtente();
    const { id } = (await a.inject({ method: "POST", url: "/api/personaggi", headers: { cookie }, payload: { dati: alston() } })).json();
    const altro = cookieDa((await a.inject({
      method: "POST", url: "/api/registrazione", payload: { username: "altro", password: "segretissima" },
    })).headers["set-cookie"]);
    expect((await a.inject({ method: "GET", url: `/api/personaggi/${id}`, headers: { cookie: altro } })).statusCode).toBe(404);
    const scrittura = await a.inject({ method: "PUT", url: `/api/personaggi/${id}`, headers: { cookie: altro }, payload: { dati: alston(), revisione: 1 } });
    expect(scrittura.statusCode).toBe(404);
    for (const url of ["/api/personaggi/abc", "/api/personaggi/99999999999", "/api/personaggi/0"]) {
      expect((await a.inject({ method: "GET", url, headers: { cookie } })).statusCode, url).toBe(404);
    }
  });

  it("richieste non valide: 400, e 413 oltre i 2 MB", async () => {
    const { app: a, cookie } = await conUtente();
    const { id } = (await a.inject({ method: "POST", url: "/api/personaggi", headers: { cookie }, payload: { dati: alston() } })).json();
    const senzaRevisione = await a.inject({ method: "PUT", url: `/api/personaggi/${id}`, headers: { cookie }, payload: { dati: alston() } });
    expect(senzaRevisione.statusCode).toBe(400);
    const revisioneStrana = await a.inject({ method: "PUT", url: `/api/personaggi/${id}`, headers: { cookie }, payload: { dati: alston(), revisione: 1.5 } });
    expect(revisioneStrana.statusCode).toBe(400);
    const schedaNonValida = await a.inject({ method: "POST", url: "/api/personaggi", headers: { cookie }, payload: { dati: "x" } });
    expect(schedaNonValida.json()).toEqual({ errore: "Scheda personaggio non valida" });
    const jsonRotto = await a.inject({
      method: "POST", url: "/api/personaggi", headers: { cookie, "content-type": "application/json" }, payload: "{rotto",
    });
    expect(jsonRotto.statusCode).toBe(400);
    const enorme = await a.inject({
      method: "POST", url: "/api/personaggi", headers: { cookie }, payload: { dati: { note: "x".repeat(3 * 1024 * 1024) } },
    });
    expect(enorme.statusCode).toBe(413);
  });
});

describe("api: catalogo e servizio", () => {
  it("incantesimi, creazione e privilegi di classe", async () => {
    const { app: a, cookie } = await conUtente();
    const incantesimi = (await a.inject({ method: "GET", url: "/api/incantesimi", headers: { cookie } })).json();
    expect(incantesimi.length).toBeGreaterThan(350);
    const creazione = (await a.inject({ method: "GET", url: "/api/creazione", headers: { cookie } })).json();
    expect(creazione.razze.length).toBeGreaterThan(0);
    const privilegi = await a.inject({ method: "GET", url: "/api/classi/Mago/privilegi?livello=2&sottoclasse=Scuola%20di%20Divinazione", headers: { cookie } });
    expect(privilegi.json().map((p: { privilegio: { nome: string } }) => p.privilegio.nome)).toContain("Presagio");
    const livelloSbagliato = await a.inject({ method: "GET", url: "/api/classi/Mago/privilegi?livello=25", headers: { cookie } });
    expect(livelloSbagliato.statusCode).toBe(400);
  });

  it("salute risponde senza sessione; le risposte non si mettono in cache; le rotte sconosciute danno 404", async () => {
    const a = await nuovaApp();
    const salute = await a.inject({ method: "GET", url: "/api/salute" });
    expect(salute.json()).toEqual({ ok: true });
    expect(salute.headers["cache-control"]).toBe("no-store");
    expect((await a.inject({ method: "GET", url: "/api/nulla" })).json()).toEqual({ errore: "Risorsa inesistente" });
  });
});
