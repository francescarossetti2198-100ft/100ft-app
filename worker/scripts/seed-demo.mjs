// Genera un file .sql con dati demo realistici (atleti, presenze storiche, sfide,
// partecipazioni, xp_log) per testare la user journey allo stato attuale di sviluppo.
// Uso: node scripts/seed-demo.mjs > seed-demo.sql
// poi: npx wrangler d1 execute 100ft-db --local --file=seed-demo.sql
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 100_000;
const HASH_BITS = 256;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    HASH_BITS
  );
  return `pbkdf2:${ITERATIONS}:${toHex(salt)}:${toHex(bits)}`;
}

function esc(s) {
  return s.replace(/'/g, "''");
}

// Lunedì più recente rispetto a oggi.
function ultimoLunedi() {
  const now = new Date();
  const giorno = (now.getUTCDay() + 6) % 7; // 0=lunedì
  now.setUTCDate(now.getUTCDate() - giorno);
  return now;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const ATLETI = [
  { nome: "Alice", cognome: "Marini", email: "alice@100ft.app", password: "demo12345", settimane: 11, sfide: 3 },
  { nome: "Marco", cognome: "Fabbri", email: "marco@100ft.app", password: "demo12345", settimane: 2, sfide: 0 },
  { nome: "Sara", cognome: "Conti", email: "sara@100ft.app", password: "demo12345", settimane: 40, sfide: 5 },
  { nome: "Luca", cognome: "Bianchi", email: "luca@100ft.app", password: "demo12345", settimane: 18, sfide: 4 },
  { nome: "Giorgia", cognome: "Ferri", email: "giorgia@100ft.app", password: "demo12345", settimane: 5, sfide: 1 },
  { nome: "Davide", cognome: "Russo", email: "davide@100ft.app", password: "demo12345", settimane: 28, sfide: 4 },
];

const SFIDE = [
  { titolo: "30 giorni di squat", descrizione: "Un po' di squat ogni giorno per un mese.", tipo: "valore_manuale", punti: 20, inizio: -20, fine: 25 },
  { titolo: "Streak del mese", descrizione: "Non saltare nessuna sessione questo mese.", tipo: "presenza", punti: 10, inizio: -20, fine: 25 },
  { titolo: "Plank Challenge", descrizione: "Quanto riesci a tenere il plank?", tipo: "valore_manuale", punti: 15, inizio: -10, fine: 20 },
  { titolo: "Sfida di Ferragosto", descrizione: "Sfida foto della settimana scorsa.", tipo: "foto", punti: 10, inizio: -30, fine: -7 },
  { titolo: "Ricordati di bere", descrizione: "Foto della borraccia durante l'allenamento.", tipo: "foto", punti: 10, inizio: -15, fine: 30 },
];

function relDate(giorni) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + giorni);
  return isoDate(d);
}

const out = [];
out.push("-- Dati demo per testare la user journey — NON usare in produzione.");

// Coach
const coachHash = await hashPassword("coach12345");
out.push(`INSERT INTO users (email, password_hash, role) VALUES ('coach@100ft.app', '${coachHash}', 'coach');`);

// Atleti + profilo
for (const a of ATLETI) {
  const hash = await hashPassword(a.password);
  out.push(`INSERT INTO users (email, password_hash, role) VALUES ('${esc(a.email)}', '${hash}', 'atleta');`);
  out.push(
    `INSERT INTO athlete_profile (user_id, nome, cognome) VALUES ((SELECT id FROM users WHERE email = '${esc(a.email)}'), '${esc(a.nome)}', '${esc(a.cognome)}');`
  );
}

// Presenze storiche: una per settimana, a ritroso dall'ultimo lunedì, + xp_log corrispondente.
// Usa sempre la sessione del lunedì (id=1 da 0002_seed_sessioni.sql) — la data non deve
// necessariamente cadere di lunedì per questo scopo dimostrativo.
const lunedi = ultimoLunedi();
for (const a of ATLETI) {
  for (let settimana = 0; settimana < a.settimane; settimana++) {
    const d = new Date(lunedi);
    d.setUTCDate(d.getUTCDate() - settimana * 7);
    const data = isoDate(d);
    out.push(
      `INSERT INTO presenze (user_id, sessione_id, data, confermata) VALUES ((SELECT id FROM users WHERE email = '${esc(a.email)}'), 1, '${data}', 1);`
    );
    out.push(
      `INSERT INTO xp_log (user_id, azione, xp_assegnati, data) VALUES ((SELECT id FROM users WHERE email = '${esc(a.email)}'), 'sessione_completata', 10, '${data}T19:00:00Z');`
    );
  }
}

// Sfide
for (const s of SFIDE) {
  out.push(
    `INSERT INTO sfide (titolo, descrizione, tipo, punti, data_inizio, data_fine) VALUES ('${esc(s.titolo)}', '${esc(s.descrizione)}', '${s.tipo}', ${s.punti}, '${relDate(s.inizio)}', '${relDate(s.fine)}');`
  );
}

// Partecipazioni: ogni atleta partecipa alle prime N sfide (per numero di sfide previste),
// scegliendo tra quelle già iniziate.
for (const a of ATLETI) {
  const sfideDisponibili = SFIDE.filter((s) => relDate(s.inizio) <= isoDate(new Date()));
  const scelte = sfideDisponibili.slice(0, a.sfide);
  for (const s of scelte) {
    out.push(
      `INSERT INTO partecipazioni_sfide (sfida_id, user_id, data, punti_assegnati) VALUES ((SELECT id FROM sfide WHERE titolo = '${esc(s.titolo)}'), (SELECT id FROM users WHERE email = '${esc(a.email)}'), '${relDate(0)}', ${s.punti});`
    );
    out.push(
      `INSERT INTO xp_log (user_id, azione, xp_assegnati) VALUES ((SELECT id FROM users WHERE email = '${esc(a.email)}'), 'sfida', ${s.punti});`
    );
  }
}

console.log(out.join("\n"));
