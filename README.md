# 100FT — App atleti

PWA per gli atleti di 100FT Functional Training (Centocelle). Vedi [`docs/100FT-app-brief.md`](docs/100FT-app-brief.md) per la spec completa e [`docs/100ft-app-mockup-v17.html`](docs/100ft-app-mockup-v17.html) per il mockup di riferimento.

## Struttura del repo

```
frontend/   PWA — Vite + JS vanilla, deploy su Cloudflare Pages
worker/     API — Cloudflare Workers + Hono + D1, deploy su Cloudflare Workers
docs/       Brief di progetto e mockup di riferimento
```

Frontend e worker sono due progetti npm separati (non un monorepo con tool dedicato — inutile per questa dimensione).

## Prerequisiti

- **Node.js 20+** — non risulta installato in questo ambiente, installalo da [nodejs.org](https://nodejs.org) prima di continuare (o con `winget install OpenJS.NodeJS.LTS`).
- Un account Cloudflare (gratuito) con `wrangler` autenticato (`npx wrangler login`, dentro `worker/`).
- Un account [resend.com](https://resend.com) (piano gratuito) per l'invio email di reset password.

## Setup iniziale

### 1. Installa le dipendenze

```bash
cd worker && npm install
cd ../frontend && npm install
```

### 2. Crea le risorse Cloudflare

```bash
cd worker
npx wrangler d1 create 100ft-db
npx wrangler r2 bucket create 100ft-foto
```

Copia il `database_id` restituito dal primo comando dentro `worker/wrangler.toml` (campo `database_id`).

### 3. Applica lo schema al database

```bash
npm run db:migrate:local    # per lo sviluppo locale
npm run db:migrate:remote   # quando sei pronta per il database di produzione
```

### 4. Configura i secrets

In locale, copia `worker/.dev.vars.example` in `worker/.dev.vars` e compila i valori (il file `.dev.vars` non va committato, è già in `.gitignore`).

Per generare l'hash della password del coach:

```bash
cd worker
node scripts/hash-coach-password.mjs "la-password-che-vuole-francesca"
```

Incolla il risultato come `COACH_PASSWORD_HASH` in `.dev.vars` (locale) e, per la produzione, imposta i secrets su Cloudflare:

```bash
npx wrangler secret put COACH_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
npx wrangler secret put RESEND_API_KEY
```

### 5. Avvia in locale

In due terminali separati:

```bash
cd worker && npm run dev      # API su http://127.0.0.1:8787
cd frontend && npm run dev    # PWA su http://localhost:5173 (proxy /api -> worker)
```

Apri `http://localhost:5173`. La schermata di login chiama `/api/auth/login`; per un primo test, registra un atleta con una chiamata a `POST /api/auth/register` (non c'è ancora una UI di registrazione — vedi "Cosa manca" sotto).

## Deploy

```bash
cd worker && npm run deploy        # pubblica il worker API
cd frontend && npm run build       # genera frontend/dist
```

Il `dist/` del frontend va collegato a un progetto Cloudflare Pages (nuovo, come deciso). Dopo il primo deploy del worker, aggiorna `FRONTEND_ORIGIN` in `worker/wrangler.toml` con l'URL reale del progetto Pages, e `VITE_API_URL` nel frontend (variabile d'ambiente Pages) con l'URL del worker.

## Cosa c'è già

- Schema D1 completo (8 blocchi del brief + tabelle di supporto: richieste pre-allenamento, sessioni di login, token di reset password) — [`worker/migrations/0001_init.sql`](worker/migrations/0001_init.sql).
- Autenticazione: registrazione/login atleti, login separato coach, sessioni persistenti su cookie httpOnly ("il device ricorda il login"), recupero password via Resend — [`worker/src/routes/auth.ts`](worker/src/routes/auth.ts).
- Hashing password con PBKDF2 via Web Crypto (nessuna dipendenza nativa, compatibile col runtime Workers).
- Scheletro PWA con le 6 schermate del mockup (login, home, programma, sfide, feed, profilo), router e tabbar — le schermate sono per ora placeholder da riempire di logica.
- Manifest PWA (installabilità) via `vite-plugin-pwa`.

## Cosa manca (prossimi passi)

- Icone PWA reali in `frontend/public/icons/` (192×192 e 512×512) — i loghi definitivi (`logo-100ft-*.png`) citati nel brief non sono ancora tra gli asset disponibili.
- UI di registrazione atleta e di recupero/reset password (gli endpoint API ci sono già).
- Rotte API e logica per: atleti/dati privati, programma mensile + merende fit, sessioni/presenze, sfide + classifica calcolata, feed + reazioni, feedback allenamento, pagamenti.
- Sfida "Ricordati di bere": notifica push a orario casuale + countdown 5 minuti (richiede Durable Objects o Cron Trigger, da progettare come segnalato nel brief).
- Sistema di livelli/medaglie (calcolo settimane cumulative, carte 512×512 già pronte in `frontend/public/cards/`).
- Pannello admin per il coach.
- Due domande aperte del brief da chiudere con Francesca: azzeramento livelli a inizio stagione, e se i mesi passati del programma restano consultabili.
