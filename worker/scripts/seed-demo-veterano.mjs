// Genera il .sql per creare in PROD un atleta demo "veterano" con storico ricco, così
// Francesca può vedere tutte le sezioni del Profilo popolate (livello, badge, statistiche,
// Performance, obiettivi, dati privati, questionario mensile).
//
// Uso:
//   node scripts/seed-demo-veterano.mjs > /tmp/seed-veterano.sql
//   npx wrangler d1 execute 100ft-db --remote --file=/tmp/seed-veterano.sql
//
// Idempotente-ish: se l'email esiste già, gli INSERT su users falliscono — cancellare prima
// (DELETE FROM users WHERE email = 'atleta.demo@100-ft.com' fa cascata su tutto).
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 100_000;
const HASH_BITS = 256;
const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, HASH_BITS);
  return `pbkdf2:${ITERATIONS}:${toHex(salt)}:${toHex(bits)}`;
}

const EMAIL = "atleta.demo@100-ft.com";
const PASSWORD = "100ft-demo";
const esc = (s) => String(s).replace(/'/g, "''");
const iso = (d) => d.toISOString().slice(0, 10);
const U = `(SELECT id FROM users WHERE email = '${esc(EMAIL)}')`;

const out = [];
out.push(`-- Atleta demo veterano — generato ${new Date().toISOString()}`);
out.push(`DELETE FROM users WHERE email = '${esc(EMAIL)}';`);

const hash = await hashPassword(PASSWORD);
out.push(`INSERT INTO users (email, password_hash, role, status) VALUES ('${esc(EMAIL)}', '${hash}', 'atleta', 'attivo');`);
out.push(
  `INSERT INTO athlete_profile (user_id, nome, cognome, nickname, data_nascita) VALUES (${U}, 'Demo', '100FT', 'DemoStar', '1993-04-18');`
);
const personalizzazione = {
  obiettivi: ["forza", "tonificare", "forma"],
  migliorare: ["forza", "core", "mobilita"],
  motivazione: ["energia", "abitudine", "meglio"],
  altri_sport: ["corsa", "camminate"],
};
out.push(
  `INSERT INTO athlete_private (user_id, peso, altezza, note_infortuni, personalizzazione) VALUES (${U}, 69.5, 174, 'Vecchio fastidio alla spalla destra, tenuto sotto controllo con la mobilità.', '${esc(
    JSON.stringify(personalizzazione)
  )}');`
);

// ── Presenze: Lun/Mer/Ven (sessioni 1/2/3) da metà gennaio a fine settembre 2026.
// ~36 settimane × 3 = ~108 allenamenti confermati → livello 6 "Leggendario" (soglia 90).
const START = new Date(Date.UTC(2026, 0, 19)); // lunedì 19 gennaio 2026
const SETTIMANE = 36;
const SESSIONI = [
  { id: 1, off: 0 }, // lunedì
  { id: 2, off: 2 }, // mercoledì
  { id: 3, off: 4 }, // venerdì
];
// Feedback post-allenamento solo sulle ultime ~18 settimane (abbastanza per statistiche/anelli).
const FEEDBACK_DA_SETT = SETTIMANE - 18;
const FACCE = [3, 4, 5, 4, 5, 4];
const DIFF = ["giusto", "impegnativo", "giusto", "facile", "tostissimo", "impegnativo"];

let nAllen = 0;
let k = 0;
for (let w = 0; w < SETTIMANE; w++) {
  for (const s of SESSIONI) {
    const d = new Date(START);
    d.setUTCDate(d.getUTCDate() + w * 7 + s.off);
    const data = iso(d);
    out.push(
      `INSERT INTO presenze (user_id, sessione_id, data, confermata) VALUES (${U}, ${s.id}, '${data}', 1);`
    );
    nAllen++;
    if (w >= FEEDBACK_DA_SETT) {
      out.push(
        `INSERT INTO feedback_allenamento (user_id, sessione_id, data, faccina, difficolta) VALUES (${U}, ${s.id}, '${data}', ${FACCE[k % FACCE.length]}, '${DIFF[k % DIFF.length]}');`
      );
      // Punti solo per gli eventi da settembre in poi (la stagione parte a settembre).
      if (data >= "2026-09-01") {
        out.push(`INSERT INTO xp_log (user_id, azione, xp_assegnati, data) VALUES (${U}, 'sessione_completata', 10, '${data}T19:00:00Z');`);
        out.push(`INSERT INTO xp_log (user_id, azione, xp_assegnati, data) VALUES (${U}, 'feedback_allenamento', 2, '${data}T20:30:00Z');`);
      }
    }
    k++;
  }
}

// ── Sfide di settembre completate tutte e 5 (id 3..7 in prod) + bonus mese + questionario.
for (const sfidaId of [3, 4, 5, 6, 7]) {
  out.push(
    `INSERT INTO partecipazioni_sfide (sfida_id, user_id, valore, foto_url, data, punti_assegnati) VALUES (${sfidaId}, ${U}, NULL, NULL, '2026-09-05', 10);`
  );
  out.push(`INSERT INTO xp_log (user_id, azione, xp_assegnati, data) VALUES (${U}, 'sfida', 10, '2026-09-05T18:00:00Z');`);
}
out.push(`INSERT INTO xp_log (user_id, azione, xp_assegnati, data) VALUES (${U}, 'sfide_mese_complete_2026_09', 10, '2026-09-05T18:00:01Z');`);

// ── Questionario mensile di agosto (mese concluso) + i suoi 15 punti.
const risposteMensili = {
  andamento: "4",
  aiutato: ["costanza", "gruppo", "allenamenti"],
  piu: ["intensita", "tecnica"],
  fisico: "bene",
  prossimo: ["forza", "costanza"],
};
out.push(
  `INSERT INTO feedback_mensile (user_id, mese, anno, risposte) VALUES (${U}, 8, 2026, '${esc(JSON.stringify(risposteMensili))}');`
);
out.push(`INSERT INTO xp_log (user_id, azione, xp_assegnati, data) VALUES (${U}, 'feedback_mensile', 15, '2026-09-02T09:00:00Z');`);

// ── Abbonamento pagato (così il Profilo mostra la luce verde "attivo" ora e a settembre).
for (const [mese, anno] of [[7, 2026], [8, 2026], [9, 2026]]) {
  out.push(
    `INSERT INTO pagamenti (user_id, mese, anno, stato, data_pagamento) VALUES (${U}, ${mese}, ${anno}, 'pagato', '${anno}-${String(mese).padStart(2, "0")}-03');`
  );
}

// ── Performance: carichi con progressione su un buon numero di esercizi.
const PERF = [
  ["Squat bilanciere", [40, 50, 60, 67.5]],
  ["Stacco", [50, 62.5, 75, 85]],
  ["Goblet squat", [16, 20, 24, 28]],
  ["Affondo manubri", [10, 12, 14, 16]],
  ["Good morning", [20, 25, 30, 35]],
  ["Affondi bulgari", [8, 10, 12, 14]],
  ["Rematore bilanciere", [30, 35, 40, 45]],
  ["Shoulder press manubri", [10, 12, 14, 16]],
  ["Chest press (petto) manubri", [14, 18, 22, 24]],
  ["Curl manubri", [8, 10, 12, 12]],
  ["Tricipiti manubri", [7, 9, 10, 12]],
  ["Alzate laterali", [4, 5, 6, 7]],
];
const PERF_DATE = ["2026-03-06", "2026-05-08", "2026-07-10", "2026-09-04"];
for (const [es, pesi] of PERF) {
  pesi.forEach((p, i) => {
    out.push(
      `INSERT INTO performance_carichi (user_id, esercizio, peso_kg, creato_il) VALUES (${U}, '${esc(es)}', ${p}, '${PERF_DATE[i]}T19:30:00Z');`
    );
  });
}

out.push(`-- Allenamenti generati: ${nAllen}`);
console.log(out.join("\n"));
