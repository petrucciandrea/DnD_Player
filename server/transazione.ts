import type { DatabaseSync } from "node:sqlite";

let contatore = 0;

// Esegue `operazione` tutta o niente. Usa i SAVEPOINT, così si può annidare
// (per esempio la migrazione crea personaggi, che a loro volta usano una transazione).
export function transazione<T>(db: DatabaseSync, operazione: () => T): T {
  const nome = `t${++contatore}`;
  db.exec(`SAVEPOINT ${nome}`);
  try {
    const risultato = operazione();
    db.exec(`RELEASE ${nome}`);
    return risultato;
  } catch (errore) {
    db.exec(`ROLLBACK TO ${nome}`);
    db.exec(`RELEASE ${nome}`);
    throw errore;
  }
}
