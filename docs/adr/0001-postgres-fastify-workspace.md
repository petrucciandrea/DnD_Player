# ADR-0001: PostgreSQL, Fastify e workspace npm

- **Stato:** accettata
- **Data:** 2026-10-06

## Contesto

Fino a questa decisione il "backend" era un plugin di Vite che esisteva solo in `vite dev` e `vite preview` e salvava tutto in un file SQLite (`node:sqlite`, sincrono). Andava bene sulla rete di casa, ma non si poteva pubblicare. In produzione non c'era un processo server, e sugli hosting gratuiti il disco è effimero, quindi il file sparirebbe a ogni riavvio. L'obiettivo è una piattaforma aperta a chiunque.

## Decisione

1. **PostgreSQL** come unico database, in produzione su Neon. Lo schema è quello di SQLite (versione 5), tradotto: `citext` al posto di `COLLATE NOCASE`, `boolean`, `timestamptz`, colonne `ordine` esplicite al posto di `rowid`.
2. **Migrazioni come file SQL numerati** (`apps/api/migrazioni/NNN_nome.sql`), applicati in ordine da un piccolo runner. Il runner registra le migrazioni in `migrazioni_applicate` e usa un lock consultivo. La storia delle migrazioni SQLite (v1–v5) non si porta: i dati si spostano con un'esportazione e un import.
3. **Nessun ORM**: `node-postgres` con SQL esplicito, come prima. Le query critiche sono scritte per la latenza di rete. `componi` legge una scheda con una sola query (`json_agg`), mentre `scomponi` e la semina inseriscono a blocchi.
4. **Fastify** come server, in TypeScript. Il backend resta nello stesso linguaggio del frontend, quindi usa le stesse funzioni di validazione (`daJSON`, `completaConEsistente`) e gli stessi tipi, senza duplicarli. Rotte e codici di risposta restano quelli del plugin, così il client non cambia contratto.
5. **Workspace npm**: `packages/regole` (codice puro condiviso: regole, tipi, validazione, cataloghi ufficiali), `apps/web` (Vite) e `apps/api` (Fastify). Il pacchetto condiviso espone i sorgenti `.ts`, che Vite, Vitest, tsx ed esbuild leggono direttamente, quindi non ha una build propria.
6. **Semina al deploy, non all'avvio.** I cataloghi ufficiali si aggiornano con `npm run semina` dopo le migrazioni, così il cold start del server non si allunga.
7. **Test su un PostgreSQL vero.** Ogni test clona un database modello già migrato e seminato. È più lento di SQLite in memoria (circa 30 s per tutta la suite), ma prova esattamente il database di produzione.

## Conseguenze

- Per sviluppare serve Docker (`docker compose up -d`). In cambio sviluppo, CI e produzione usano lo stesso PostgreSQL 17.
- Il livello dati è asincrono. Le transazioni passano da `transazione()` in `apps/api/src/db.ts`, che si annida con i SAVEPOINT.
- La concorrenza ottimistica è atomica: un `UPDATE … WHERE revisione = $3` blocca la riga, quindi due salvataggi contemporanei non passano entrambi.
- I seed degli incantesimi stanno in `packages/regole/src/semi/` e non in `apps/api`, perché li usano anche i test delle regole.
- Lo schema si cambia solo con una nuova migrazione, compatibile con la versione del server ancora in esecuzione (vedi ADR-0002).
