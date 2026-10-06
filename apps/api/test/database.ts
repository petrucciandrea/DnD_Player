import { randomBytes } from "node:crypto";
import type pg from "pg";
import { afterAll } from "vitest";
import { creaPool } from "../src/db.ts";
import { DB_MODELLO, eseguiComeAmministratore, PREFISSO, urlDatabase } from "./amministrazione.ts";

const aperti: { pool: pg.Pool; nome: string }[] = [];

// Un archivio nuovo per ogni test: copia del modello, già migrato e con i cataloghi, senza utenti.
// Più file di test clonano lo stesso modello in parallelo: se è occupato si riprova.
export async function archivioDiProva(): Promise<pg.Pool> {
  const nome = `${PREFISSO}${randomBytes(6).toString("hex")}`;
  for (let tentativo = 0; ; tentativo++) {
    try {
      await eseguiComeAmministratore(`CREATE DATABASE ${nome} TEMPLATE ${DB_MODELLO}`);
      break;
    } catch (errore) {
      if (tentativo >= 30 || !/being accessed by other users/.test(String(errore))) throw errore;
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
    }
  }
  const pool = creaPool(urlDatabase(nome), { max: 3 });
  aperti.push({ pool, nome });
  return pool;
}

afterAll(async () => {
  const daChiudere = aperti.splice(0);
  await Promise.all(daChiudere.map(a => a.pool.end()));
  if (daChiudere.length) await eseguiComeAmministratore(...daChiudere.map(a => `DROP DATABASE IF EXISTS ${a.nome} WITH (FORCE)`));
});
