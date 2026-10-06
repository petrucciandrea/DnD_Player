# ADR-0002: pubblicazione su piani gratuiti (Vercel, Render, Neon)

- **Stato:** accettata
- **Data:** 2026-10-06

## Contesto

La piattaforma deve essere raggiungibile da internet senza costi fissi, con dati persistenti, HTTPS e un deploy ripetibile. È la stessa architettura di un altro progetto già pubblicato, adattata a un frontend Vite statico e a un backend Node.

## Decisione

```
Browser → Vercel (app statica) → Render (API Fastify, Docker) → Neon (PostgreSQL)
```

- **Neon** per PostgreSQL: gratuito, circa 0,5 GB, si sospende quando è inattivo. Regione `aws-eu-central-1`. Si usa la stringa di connessione diretta (senza `-pooler`), come raccomanda Neon per le migrazioni; il server ha già un suo pool (al massimo 5 connessioni).
- **Render** per l'API, costruita dal `Dockerfile` (lo stage di produzione è l'ultimo, perché Render non permette di scegliere `--target`) e descritta in `render.yaml`, regione Frankfurt. Il deploy automatico è spento (`autoDeployTrigger: "off"`): lo avvia il workflow `Deploy` con il deploy hook del servizio, passando il commit esatto. Health check su `/api/salute`.
- **Vercel** per l'app statica (Root Directory `apps/web`). Le rewrite di `vercel.json` inoltrano `/api` a Render. Per il browser è tutto la stessa origine, quindi niente CORS e il cookie di sessione resta `HttpOnly; SameSite=Strict; Secure`. L'indirizzo di Render è scritto in `vercel.json`, perché le rewrite non leggono variabili d'ambiente.
- **GitHub Actions**: la CI (lint, typecheck, test con PostgreSQL, build, docker) gira a ogni PR. Il workflow `Deploy` parte dopo la CI verde su `main`, applica migrazioni e semina su Neon e poi chiama il deploy hook: **prima lo schema, poi il codice**. I segreti (`PRODUCTION_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`) stanno nell'environment `production`.
- **Ruleset su `main`**: PR obbligatoria e controlli della CI obbligatori, senza bypass.

## Conseguenze

- **Risveglio**: Render gratis si spegne dopo 15 minuti senza richieste, e la prima richiesta successiva aspetta circa 30-60 s. Il client riprova fino a 90 s e mostra un messaggio. Durante il gioco la sincronizzazione ogni 15 s tiene il server acceso.
- **Migrazioni retrocompatibili**: tra le migrazioni e l'avvio del nuovo server gira ancora il codice precedente. Si aggiungono colonne e tabelle, e si tolgono solo in un deploy successivo.
- **Uso non commerciale**: è un vincolo del piano Hobby di Vercel. Se il progetto diventasse commerciale, servirebbe un piano a pagamento o un altro hosting per l'app statica, che potrebbe servire anche Fastify stesso.
- **Limiti ai tentativi**: l'API sta dietro due proxy (Vercel e Render) e si fida di `X-Forwarded-For`. Per questo l'accesso è limitato per username (10 tentativi ogni 5 minuti), oltre all'attesa di 1 s dopo una password sbagliata. Chi indovina uno username può bloccarne l'accesso per qualche minuto: è il prezzo accettato per proteggere le password.
- **Backup**: la storia di Neon permette di ripristinare un momento passato, ma sul piano gratuito copre un periodo breve. Un backup periodico (`pg_dump` da un workflow programmato) è un lavoro da fare dopo.
- **Configurazione attuale** (7 ottobre 2026): app su https://dnd-player-two.vercel.app (progetto Vercel `dnd-player`), API su https://dnd-api-6pmu.onrender.com (servizio Render `dnd-api`, branch `main`), Neon `dnd-player` a Francoforte, ruleset "Protezione di main" con i cinque controlli della CI e nessun bypass.
- **Trappole incontrate nella prima pubblicazione**: Render (Blueprint) e Vercel (Root Directory) leggono la struttura del branch scelto, quindi il codice nuovo deve essere già su `main`, oppure il primo collegamento si fa su `sviluppo` e poi si sposta il servizio su `main`. `gh secret set --env production` risponde 404 se l'environment non esiste ancora: va creato prima. Il sottodominio `dnd-player.vercel.app` era già di un altro progetto, e gli indirizzi dei singoli deploy di Vercel sono protetti dal login (quello pubblico è in *Settings → Domains*). Neon propone di attivare anche Object storage e altri servizi, che qui non servono.
- **Trappole note**: `channel_binding` e `sslmode` nell'URL di Neon (gestiti da `opzioniConnessione`). Deploy Hook del servizio, non Sync Hook del Blueprint. `gh secret set` con il valore incollato al prompt (zsh e `?`). Tag delle action da verificare uno per uno. Il ruleset blocca anche il proprietario.
