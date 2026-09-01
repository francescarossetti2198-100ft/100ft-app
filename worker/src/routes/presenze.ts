import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { oggi, sessioneOggi, adessoRoma } from "../lib/oggi";
import { assegnaMilestone } from "../lib/milestones";
import { snapshotProgressione, segnalaAvanzamento } from "../lib/progressione";

type Variables = { user: SessionUser };
const presenze = new Hono<{ Bindings: Env; Variables: Variables }>();

// Giorno della settimana (1=lun ... 7=dom) di una data YYYY-MM-DD.
function giornoSettimanaDi(data: string): number {
  return ((new Date(`${data}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

// Ultime N date (dalla più recente) che hanno avuto un allenamento, entro `giorni` giorni fa.
async function giorniAllenamentoRecenti(db: D1Database, quante = 10, giorni = 28): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT DISTINCT giorno_settimana FROM sessioni_gruppo`)
    .all<{ giorno_settimana: number }>();
  const giorniConSessione = new Set(results.map((r) => r.giorno_settimana));
  const out: string[] = [];
  const d = adessoRoma();
  for (let i = 0; i < giorni && out.length < quante; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (giorniConSessione.has(giornoSettimanaDi(iso))) out.push(iso);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

// Primo giorno di allenamento da oggi in avanti (oggi compreso) che non è chiuso.
async function prossimoGiornoAllenamento(db: D1Database): Promise<string | null> {
  const { results } = await db
    .prepare(`SELECT DISTINCT giorno_settimana FROM sessioni_gruppo`)
    .all<{ giorno_settimana: number }>();
  const giorniConSessione = new Set(results.map((r) => r.giorno_settimana));
  if (giorniConSessione.size === 0) return null;
  const d = adessoRoma();
  for (let i = 0; i < 14; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (giorniConSessione.has(giornoSettimanaDi(iso))) {
      const chiuso = await db.prepare(`SELECT 1 FROM giorni_chiusi WHERE data = ?`).bind(iso).first();
      if (!chiuso) return iso;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return null;
}

// Giorno di allenamento passato più recente per cui il coach non ha ancora chiuso l'appello.
async function appelloDaChiudere(db: D1Database, oggiData: string): Promise<string | null> {
  for (const g of await giorniAllenamentoRecenti(db, 10, 28)) {
    if (g >= oggiData) continue;
    const sess = await db
      .prepare(`SELECT id FROM sessioni_gruppo WHERE giorno_settimana = ?`)
      .bind(giornoSettimanaDi(g))
      .first<{ id: number }>();
    if (!sess) continue;
    const fatto = await db
      .prepare(`SELECT 1 FROM appello_conferme WHERE data = ? AND sessione_id = ?`)
      .bind(g, sess.id)
      .first();
    if (!fatto) return g;
  }
  return null;
}

// ── COACH: cruscotto "Oggi" ───────────────────────────────────────────────────

type ProssimaSessione = {
  data: string | null;
  oggi: boolean;
  sessione: { oraInizio: string; oraFine: string } | null;
  prenotati: string[];
  nPrenotati: number;
  richieste: { nome: string; categoria: string | null; testoLibero: string | null }[];
  nota: string | null;
  appelloDaChiudere: { data: string } | null;
};

// Tutto quello che serve alla coach per il prossimo allenamento, in una chiamata.
presenze.get("/prossima", requireCoach, async (c) => {
  const { data: oggiData } = oggi();
  const appelloAperto = await appelloDaChiudere(c.env.DB, oggiData);
  const vuoto: ProssimaSessione = {
    data: null, oggi: false, sessione: null, prenotati: [], nPrenotati: 0,
    richieste: [], nota: null, appelloDaChiudere: appelloAperto ? { data: appelloAperto } : null,
  };

  const data = await prossimoGiornoAllenamento(c.env.DB);
  if (!data) return c.json(vuoto);

  const sessione = await c.env.DB
    .prepare(`SELECT id, ora_inizio AS oraInizio, ora_fine AS oraFine FROM sessioni_gruppo WHERE giorno_settimana = ?`)
    .bind(giornoSettimanaDi(data))
    .first<{ id: number; oraInizio: string; oraFine: string }>();
  if (!sessione) return c.json(vuoto);

  const prenotati = await c.env.DB.prepare(
    `SELECT COALESCE(p.nickname, p.nome) AS nome
     FROM presenze pr
     JOIN athlete_profile p ON p.user_id = pr.user_id
     WHERE pr.sessione_id = ? AND pr.data = ? AND pr.presenza_richiesta = 1
     ORDER BY nome`
  )
    .bind(sessione.id, data)
    .all<{ nome: string }>();

  const nota = await c.env.DB.prepare(`SELECT testo FROM nota_coach WHERE data = ?`)
    .bind(data)
    .first<{ testo: string }>();

  const richieste = await c.env.DB.prepare(
    `SELECT COALESCE(p.nickname, p.nome) AS nome, r.categoria, r.testo_libero AS testoLibero
     FROM richieste_preallenamento r
     JOIN athlete_profile p ON p.user_id = r.user_id
     WHERE r.sessione_id = ? AND r.data_sessione = ?
     ORDER BY r.creata_il`
  )
    .bind(sessione.id, data)
    .all<{ nome: string; categoria: string | null; testoLibero: string | null }>();

  const payload: ProssimaSessione = {
    data,
    oggi: data === oggiData,
    sessione: { oraInizio: sessione.oraInizio, oraFine: sessione.oraFine },
    prenotati: prenotati.results.map((r) => r.nome),
    nPrenotati: prenotati.results.length,
    richieste: richieste.results,
    nota: nota?.testo ?? null,
    appelloDaChiudere: appelloAperto ? { data: appelloAperto } : null,
  };
  return c.json(payload);
});

// ── ATLETA ────────────────────────────────────────────────────────────────────

// Presenza è solo per il giorno stesso, niente prenotazioni future (brief, sezione 3).
presenze.get("/oggi", requireAuth, async (c) => {
  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ sessione: null, richiesta: false, confermata: false, roster: [] });

  const { data } = oggi();
  const [mia, roster] = await Promise.all([
    c.env.DB.prepare(
      `SELECT presenza_richiesta AS richiesta, confermata FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ?`
    )
      .bind(c.var.user.userId, sessione.id, data)
      .first<{ richiesta: number; confermata: number }>(),
    // Roster della sessione di oggi: chi ha messo "presente" e chi no (lo vedono tutti gli
    // atleti, come già erano visibili le presenze "in sala").
    c.env.DB.prepare(
      `SELECT p.nome, p.nickname,
              COALESCE(pr.presenza_richiesta, 0) AS richiesta,
              COALESCE(pr.confermata, 0) AS confermata
       FROM users u
       JOIN athlete_profile p ON p.user_id = u.id
       LEFT JOIN presenze pr ON pr.user_id = u.id AND pr.sessione_id = ? AND pr.data = ?
       WHERE u.role = 'atleta' AND u.status = 'attivo'
       ORDER BY p.nome, p.cognome`
    )
      .bind(sessione.id, data)
      .all<{ nome: string; nickname: string | null; richiesta: number; confermata: number }>(),
  ]);

  return c.json({
    sessione,
    richiesta: !!mia?.richiesta,
    confermata: !!mia?.confermata,
    roster: roster.results.map((r) => ({
      nome: r.nickname || r.nome,
      presente: !!r.confermata || !!r.richiesta,
    })),
  });
});

// L'atleta "prenota" (o annulla) la presenza per la sessione di OGGI — modificabile finché
// è oggi. Non assegna punti: quelli arrivano solo con la conferma del coach all'appello.
presenze.post("/conferma", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") {
    return c.json({ error: "Solo gli atleti possono cambiare la presenza" }, 403);
  }

  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ error: "Nessuna sessione oggi" }, 400);

  const body = await c.req.json<{ presente?: boolean }>().catch(() => ({}) as { presente?: boolean });
  const richiesta = body.presente !== false;

  const { data } = oggi();
  await c.env.DB.prepare(
    `INSERT INTO presenze (user_id, sessione_id, data, presenza_richiesta) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, sessione_id, data) DO UPDATE SET presenza_richiesta = excluded.presenza_richiesta`
  )
    .bind(c.var.user.userId, sessione.id, data, richiesta ? 1 : 0)
    .run();

  return c.json({ ok: true, richiesta });
});

// ── COACH: appello digitale ───────────────────────────────────────────────────

// Elenco atleti per l'appello di una data (default oggi) + giorni di allenamento recenti.
presenze.get("/appello", requireCoach, async (c) => {
  const giorniRecenti = await giorniAllenamentoRecenti(c.env.DB);

  // Senza `data` esplicita si parte dall'ultimo giorno di allenamento (oggi se c'è
  // sessione, altrimenti il più recente) — l'appello riguarda una sessione già svolta.
  const richiesta = c.req.query("data");
  const data = richiesta || giorniRecenti[0] || oggi().data;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return c.json({ error: "Data non valida" }, 400);

  const sessione = await c.env.DB
    .prepare(`SELECT id, ora_inizio AS oraInizio, ora_fine AS oraFine FROM sessioni_gruppo WHERE giorno_settimana = ?`)
    .bind(giornoSettimanaDi(data))
    .first<{ id: number; oraInizio: string; oraFine: string }>();

  if (!sessione) return c.json({ data, sessione: null, atleti: [], confermato: false, giorniRecenti });

  const [atleti, conferma] = await Promise.all([
    c.env.DB.prepare(
      `SELECT u.id AS userId, p.nome, p.cognome, p.nickname,
              COALESCE(pr.presenza_richiesta, 0) AS richiesta,
              COALESCE(pr.confermata, 0) AS confermata
       FROM users u
       JOIN athlete_profile p ON p.user_id = u.id
       LEFT JOIN presenze pr ON pr.user_id = u.id AND pr.sessione_id = ? AND pr.data = ?
       WHERE u.role = 'atleta' AND u.status = 'attivo'
       ORDER BY p.nome, p.cognome`
    )
      .bind(sessione.id, data)
      .all<{ userId: number; nome: string; cognome: string | null; nickname: string | null; richiesta: number; confermata: number }>(),
    c.env.DB.prepare(`SELECT 1 FROM appello_conferme WHERE data = ? AND sessione_id = ?`)
      .bind(data, sessione.id)
      .first(),
  ]);

  return c.json({
    data,
    sessione: { id: sessione.id, oraInizio: sessione.oraInizio, oraFine: sessione.oraFine },
    atleti: atleti.results.map((a) => ({
      userId: a.userId,
      nome: a.nome,
      cognome: a.cognome,
      nickname: a.nickname,
      richiesta: !!a.richiesta,
      confermata: !!a.confermata,
    })),
    confermato: !!conferma,
    giorniRecenti,
  });
});

// Riepilogo per il coach: per un giorno di allenamento, chi c'era e il feedback che ha
// lasciato. Sola lettura (l'appello si fa dall'endpoint /appello).
presenze.get("/riepilogo", requireCoach, async (c) => {
  const giorniRecenti = await giorniAllenamentoRecenti(c.env.DB, 20);
  const richiesta = c.req.query("data");
  const data = richiesta || giorniRecenti[0] || oggi().data;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return c.json({ error: "Data non valida" }, 400);

  const sessione = await c.env.DB
    .prepare(`SELECT id, ora_inizio AS oraInizio, ora_fine AS oraFine FROM sessioni_gruppo WHERE giorno_settimana = ?`)
    .bind(giornoSettimanaDi(data))
    .first<{ id: number; oraInizio: string; oraFine: string }>();

  if (!sessione) return c.json({ data, sessione: null, atleti: [], appelloFatto: false, giorniRecenti });

  const [atleti, conferma] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.nome, p.cognome, p.nickname,
              COALESCE(pr.presenza_richiesta, 0) AS richiesta,
              COALESCE(pr.confermata, 0) AS confermata,
              f.faccina, f.difficolta, f.nota
       FROM users u
       JOIN athlete_profile p ON p.user_id = u.id
       LEFT JOIN presenze pr ON pr.user_id = u.id AND pr.sessione_id = ? AND pr.data = ?
       LEFT JOIN feedback_allenamento f ON f.user_id = u.id AND f.sessione_id = ? AND f.data = ?
       WHERE u.role = 'atleta' AND u.status = 'attivo'
       ORDER BY p.nome, p.cognome`
    )
      .bind(sessione.id, data, sessione.id, data)
      .all<{
        nome: string;
        cognome: string | null;
        nickname: string | null;
        richiesta: number;
        confermata: number;
        faccina: number | null;
        difficolta: string | null;
        nota: string | null;
      }>(),
    c.env.DB.prepare(`SELECT 1 FROM appello_conferme WHERE data = ? AND sessione_id = ?`)
      .bind(data, sessione.id)
      .first(),
  ]);

  const appelloFatto = !!conferma;

  return c.json({
    data,
    sessione: { id: sessione.id, oraInizio: sessione.oraInizio, oraFine: sessione.oraFine },
    appelloFatto,
    giorniRecenti,
    atleti: atleti.results.map((a) => {
      let stato: "presente" | "assente" | "prenotato" | "indeciso";
      if (a.confermata) stato = "presente";
      else if (appelloFatto) stato = "assente";
      else if (a.richiesta) stato = "prenotato";
      else stato = "indeciso";
      return {
        nome: [a.nome, a.cognome].filter(Boolean).join(" ") || a.nickname || a.nome,
        stato,
        feedback:
          a.faccina != null ? { faccina: a.faccina, difficolta: a.difficolta, nota: a.nota } : null,
      };
    }),
  });
});

// Il coach conferma l'appello: i presenti prendono i 10 punti, gli altri li perdono se li avevano.
presenze.post("/appello", requireCoach, async (c) => {
  const body = await c.req
    .json<{ data?: string; sessioneId?: number; presentiUserIds?: number[] }>()
    .catch(() => ({}) as { data?: string; sessioneId?: number; presentiUserIds?: number[] });

  const data = body.data ?? "";
  const sessioneId = Number(body.sessioneId);
  const presenti = new Set((body.presentiUserIds ?? []).map(Number));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isInteger(sessioneId)) {
    return c.json({ error: "Dati appello non validi" }, 400);
  }

  const sessione = await c.env.DB.prepare(`SELECT id FROM sessioni_gruppo WHERE id = ?`)
    .bind(sessioneId)
    .first();
  if (!sessione) return c.json({ error: "Sessione non trovata" }, 404);

  const { results: atleti } = await c.env.DB.prepare(
    `SELECT u.id AS userId, COALESCE(pr.confermata, 0) AS confermata
     FROM users u
     LEFT JOIN presenze pr ON pr.user_id = u.id AND pr.sessione_id = ? AND pr.data = ?
     WHERE u.role = 'atleta' AND u.status = 'attivo'`
  )
    .bind(sessioneId, data)
    .all<{ userId: number; confermata: number }>();

  for (const a of atleti) {
    const era = a.confermata === 1;
    const sara = presenti.has(a.userId);
    if (era === sara) continue;

    const prima = await snapshotProgressione(c.env.DB, a.userId);

    await c.env.DB.prepare(
      `INSERT INTO presenze (user_id, sessione_id, data, confermata, presenza_richiesta)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT (user_id, sessione_id, data) DO UPDATE SET confermata = excluded.confermata`
    )
      .bind(a.userId, sessioneId, data, sara ? 1 : 0)
      .run();

    if (sara) {
      await awardXp(c.env.DB, a.userId, "sessione_completata", 10);
    } else {
      await c.env.DB.prepare(
        `DELETE FROM xp_log WHERE id = (
           SELECT id FROM xp_log
           WHERE user_id = ? AND azione = 'sessione_completata'
           ORDER BY id DESC LIMIT 1
         )`
      )
        .bind(a.userId)
        .run();
    }

    const dopo = await snapshotProgressione(c.env.DB, a.userId);
    await segnalaAvanzamento(c.env.DB, a.userId, prima, dopo);

    if (sara) {
      const tot = await c.env.DB.prepare(
        `SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`
      )
        .bind(a.userId)
        .first<{ n: number }>();
      if (tot?.n === 1) await assegnaMilestone(c.env.DB, a.userId, "first_session");
      if (tot?.n === 10) await assegnaMilestone(c.env.DB, a.userId, "10_sessions");
      if (tot?.n === 25) await assegnaMilestone(c.env.DB, a.userId, "25_sessions");
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO appello_conferme (data, sessione_id, confermato_il) VALUES (?, ?, datetime('now'))
     ON CONFLICT (data, sessione_id) DO UPDATE SET confermato_il = datetime('now')`
  )
    .bind(data, sessioneId)
    .run();

  return c.json({ ok: true, presenti: [...presenti] });
});

export default presenze;
