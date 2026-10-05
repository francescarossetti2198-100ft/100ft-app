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

// Presenze storiche: TUTTE e 3 le sessioni della settimana (lun/mer/ven, id 1/2/3 da
// 0002_seed_sessioni.sql), a ritroso dall'ultimo lunedì — così ogni settimana risulta
// "chiusa" secondo la regola in lib/settimana.ts (anello allenamenti pieno).
const lunedi = ultimoLunedi();
for (const a of ATLETI) {
  for (let settimana = 0; settimana < a.settimane; settimana++) {
    for (const sessioneId of [1, 2, 3]) {
      const offsetGiorni = sessioneId === 1 ? 0 : sessioneId === 2 ? 2 : 4; // lun/mer/ven
      const d = new Date(lunedi);
      d.setUTCDate(d.getUTCDate() - settimana * 7 + offsetGiorni);
      const data = isoDate(d);
      out.push(
        `INSERT INTO presenze (user_id, sessione_id, data, confermata) VALUES ((SELECT id FROM users WHERE email = '${esc(a.email)}'), ${sessioneId}, '${data}', 1);`
      );
      out.push(
        `INSERT INTO xp_log (user_id, azione, xp_assegnati, data) VALUES ((SELECT id FROM users WHERE email = '${esc(a.email)}'), 'sessione_completata', 10, '${data}T19:00:00Z');`
      );
      // Feedback "How was today?" per ogni sessione storica, altrimenti l'anello FEEDBACK
      // (funzionalità nuova) azzererebbe tutte le settimane completate della demo.
      const faccina = [3, 4, 5, 4, 5][(settimana + sessioneId) % 5];
      out.push(
        `INSERT INTO feedback_allenamento (user_id, sessione_id, data, faccina) VALUES ((SELECT id FROM users WHERE email = '${esc(a.email)}'), ${sessioneId}, '${data}', ${faccina});`
      );
    }
  }
}

// Backfill di sfide mensili per gli ultimi mesi, altrimenti l'anello CHALLENGES (ora
// mensile, brief aggiornato) non chiuderebbe mai retroattivamente e nessuna settimana
// storica risulterebbe completa. Copre solo gli ultimi 3 mesi (non l'intera storia di
// ogni atleta) — oltre diventa dispendioso generare dati di fantasia; i livelli demo
// saranno quindi più bassi di prima, per design (Feedback e Challenges mensili sono
// requisiti nuovi, prima bastava la sola presenza).
const MESI_BACKFILL = 3;
const oraSeed = new Date();
for (let m = 0; m < MESI_BACKFILL; m++) {
  const meseDate = new Date(Date.UTC(oraSeed.getUTCFullYear(), oraSeed.getUTCMonth() - m, 1));
  const annoMese = `${meseDate.getUTCFullYear()}-${String(meseDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const fineMese = new Date(Date.UTC(meseDate.getUTCFullYear(), meseDate.getUTCMonth() + 1, 0));

  for (let i = 1; i <= 4; i++) {
    const titolo = `Sfida mensile ${annoMese} #${i}`;
    out.push(
      `INSERT INTO sfide (titolo, descrizione, tipo, punti, data_inizio, data_fine) VALUES ('${esc(titolo)}', 'Sfida mensile generata per la demo', 'valore_manuale', 10, '${isoDate(meseDate)}', '${isoDate(fineMese)}');`
    );

    for (const a of ATLETI) {
      // Approssimazione: partecipa se aveva già iniziato ad allenarsi in quel mese
      // (circa 4 settimane per mese di anzianità).
      if (a.settimane >= (m + 1) * 4) {
        out.push(
          `INSERT INTO partecipazioni_sfide (sfida_id, user_id, valore, data, punti_assegnati) VALUES ((SELECT id FROM sfide WHERE titolo = '${esc(titolo)}'), (SELECT id FROM users WHERE email = '${esc(a.email)}'), 'demo', '${isoDate(meseDate)}', 10);`
        );
        out.push(
          `INSERT INTO xp_log (user_id, azione, xp_assegnati, data) VALUES ((SELECT id FROM users WHERE email = '${esc(a.email)}'), 'sfida', 10, '${isoDate(meseDate)}T12:00:00Z');`
        );
      }
    }
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

// Programma mensile — una stagione intera (brief, sezione 13: settembre -> luglio) nel
// passato rispetto a oggi, così risulta tutta sbloccata e navigabile per la demo.
const PROGRAMMA = [
  {
    mese: 9, anno: 2025, focusTema: "Definizione",
    descrizione: "Si riparte con lavoro metabolico ad alta densità: circuiti a tempo, core stability, recuperi calibrati al caldo di fine estate. L'obiettivo del mese è ritrovare la condizione, non cercare i massimali.",
    lineeGuidaNutrizionali: "Coerenti con un mese ad alta densità metabolica: idratazione costante, pasto post-allenamento entro 60 minuti con proteine e carboidrati, attenzione al sale nei giorni più caldi.",
    merende: [
      { titolo: "Yogurt greco + frutti di bosco", descrizione: "Pre-allenamento" },
      { titolo: "Banana + burro di arachidi", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 10, anno: 2025, focusTema: "Forza",
    descrizione: "Si alza il carico: schemi di forza su squat, hinge, push e pull, con più recupero tra le serie. Tecnica prima di tutto, la velocità viene dopo.",
    lineeGuidaNutrizionali: "Più attenzione alle proteine nei pasti principali per sostenere il recupero; niente diete drastiche in un mese di carico.",
    merende: [
      { titolo: "Uovo sodo + frutta secca", descrizione: "Pre-allenamento" },
      { titolo: "Skyr + miele", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 11, anno: 2025, focusTema: "Resistenza",
    descrizione: "Circuiti più lunghi, meno pause, ritmo cardiovascolare sostenuto. Il mese giusto per costruire la base di fondo prima dell'inverno.",
    lineeGuidaNutrizionali: "Carboidrati a lento rilascio nei pasti prima dell'allenamento, idratazione con elettroliti nelle sessioni più intense.",
    merende: [
      { titolo: "Avena + frutta fresca", descrizione: "Pre-allenamento" },
      { titolo: "Smoothie proteico", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 12, anno: 2025, focusTema: "Mobilità",
    descrizione: "Mese più leggero sul volume, più lavoro su mobilità articolare e controllo motorio. Utile per arrivare alle feste senza accumulare fatica.",
    lineeGuidaNutrizionali: "Nessuna restrizione particolare per le feste — solo attenzione a non saltare i pasti principali nei giorni di allenamento.",
    merende: [
      { titolo: "Cioccolato fondente + mandorle", descrizione: "Pre-allenamento" },
      { titolo: "Ricotta + pera", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 1, anno: 2026, focusTema: "Reset & Costanza",
    descrizione: "Si riparte con gradualità dopo le feste: l'obiettivo non è strafare a gennaio, ma tornare a una routine costante e sostenibile.",
    lineeGuidaNutrizionali: "Pasti regolari, niente diete lampo — l'idea è ricostruire l'abitudine, non compensare le feste in una settimana.",
    merende: [
      { titolo: "Yogurt + cereali integrali", descrizione: "Pre-allenamento" },
      { titolo: "Toast integrale + tacchino", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 2, anno: 2026, focusTema: "Potenza",
    descrizione: "Movimenti esplosivi e balistici (salti, lanci, sprint brevi) innestati sulla base di forza costruita a ottobre. Qualità sopra quantità.",
    lineeGuidaNutrizionali: "Pasto pre-allenamento leggero e digeribile, per arrivare scarichi ma non a stomaco vuoto ai movimenti esplosivi.",
    merende: [
      { titolo: "Banana + caffè", descrizione: "Pre-allenamento" },
      { titolo: "Frullato proteico + frutta", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 3, anno: 2026, focusTema: "Core & Stabilità",
    descrizione: "Lavoro mirato su core, anti-rotazione e controllo del bacino — la base che rende più sicuri ed efficaci tutti gli altri movimenti.",
    lineeGuidaNutrizionali: "Nessuna indicazione specifica questo mese: si torna alle linee guida generali di idratazione e pasto post-allenamento.",
    merende: [
      { titolo: "Hummus + verdure crude", descrizione: "Pre-allenamento" },
      { titolo: "Yogurt greco + noci", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 4, anno: 2026, focusTema: "Cardio & Conditioning",
    descrizione: "Intensità cardiovascolare al centro: intervalli, circuiti misti, recuperi attivi. Si comincia a preparare il fisico verso l'estate.",
    lineeGuidaNutrizionali: "Idratazione ancora più centrale con l'aumento delle temperature primaverili; carboidrati coerenti col volume di lavoro.",
    merende: [
      { titolo: "Frutta fresca + fiocchi d'avena", descrizione: "Pre-allenamento" },
      { titolo: "Bowl di quinoa + legumi", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 5, anno: 2026, focusTema: "Definizione Estiva",
    descrizione: "Circuiti metabolici ad alta densità, simili a settembre ma con una base di forza e resistenza costruita nei mesi precedenti.",
    lineeGuidaNutrizionali: "Attenzione alla qualità dei pasti più che alla quantità; niente restrizioni drastiche in vista dell'estate.",
    merende: [
      { titolo: "Anguria + menta", descrizione: "Pre-allenamento" },
      { titolo: "Yogurt + frutti di bosco", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 6, anno: 2026, focusTema: "Performance",
    descrizione: "Il mese in cui si mettono insieme forza, potenza e resistenza costruite durante l'anno. Test dei Personal Best del gruppo.",
    lineeGuidaNutrizionali: "Pasti bilanciati e regolari nei giorni dei test; niente sperimentazioni nutrizionali last-minute.",
    merende: [
      { titolo: "Toast + marmellata", descrizione: "Pre-allenamento" },
      { titolo: "Petto di pollo + riso", descrizione: "Post-allenamento" },
    ],
  },
  {
    mese: 7, anno: 2026, focusTema: "Mantenimento",
    descrizione: "Ultimo mese prima della pausa estiva: volume più leggero, focus sul mantenere quanto costruito e chiudere la stagione senza infortuni.",
    lineeGuidaNutrizionali: "Idratazione costante col caldo, pasti leggeri ma completi — si chiude la stagione, non ci si ferma di colpo.",
    merende: [
      { titolo: "Cocomero + lime", descrizione: "Pre-allenamento" },
      { titolo: "Insalata di farro + legumi", descrizione: "Post-allenamento" },
    ],
  },
];

for (const p of PROGRAMMA) {
  out.push(
    `INSERT INTO programma_mensile (mese, anno, focus_tema, descrizione, linee_guida_nutrizionali) VALUES (${p.mese}, ${p.anno}, '${esc(p.focusTema)}', '${esc(p.descrizione)}', '${esc(p.lineeGuidaNutrizionali)}');`
  );
  p.merende.forEach((mf, i) => {
    out.push(
      `INSERT INTO merende_fit (programma_id, titolo, descrizione, ordine) VALUES ((SELECT id FROM programma_mensile WHERE mese = ${p.mese} AND anno = ${p.anno}), '${esc(mf.titolo)}', '${esc(mf.descrizione)}', ${i});`
    );
  });
}

// Feed — qualche post demo (i post automatici veri scattano solo al momento della conferma
// presenza, non retroattivamente: questi rappresentano cosa sarebbe successo nel tempo).
out.push(
  `INSERT INTO post_feed (user_id, tipo, testo) VALUES (NULL, 'annuncio_coach', 'Benvenuti nella nuova stagione 100FT! Vi aspetto in sala 💪');`
);
out.push(
  `INSERT INTO post_feed (user_id, tipo, testo) VALUES ((SELECT id FROM users WHERE email = 'davide@100ft.app'), 'level_up', 'Livello 5 — Esperto');`
);
out.push(
  `INSERT INTO post_feed (user_id, tipo, testo) VALUES ((SELECT id FROM users WHERE email = 'sara@100ft.app'), 'consistency', '36 settimane di fila con tutti gli allenamenti completati');`
);
out.push(
  `INSERT INTO post_feed (user_id, tipo, testo) VALUES ((SELECT id FROM users WHERE email = 'luca@100ft.app'), 'level_up', 'Livello 4 — Avanzato');`
);

console.log(out.join("\n"));
