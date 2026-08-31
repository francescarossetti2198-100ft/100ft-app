import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { inizioSettimana } from "../lib/settimana";
import { adessoRoma } from "../lib/oggi";
import { snapshotProgressione, segnalaAvanzamento } from "../lib/progressione";
import { awardXp } from "../lib/xp";

// Scala fissa del feedback "Com'è andata oggi?" — sempre e solo queste 5 faccine, mai stelle,
// slider, numeri o altre emoji.
const FACCE = [1, 2, 3, 4, 5];

// Seconda (e ultima) domanda del feedback: "Come ti è sembrato l'allenamento?" — 4 livelli fissi.
const DIFFICOLTA = ["facile", "giusto", "impegnativo", "tostissimo"];

type Variables = { user: SessionUser };
const feedback = new Hono<{ Bindings: Env; Variables: Variables }>();

// Sessioni di questa settimana a cui l'atleta ha partecipato ma senza feedback ancora dato —
// disponibili solo dopo la fine della sessione (Presenza -> Allenamento -> Feedback).
feedback.get("/da-dare", requireAuth, async (c) => {
  const inizioSett = inizioSettimana(adessoRoma());
  const fineSett = new Date(inizioSett);
  fineSett.setUTCDate(fineSett.getUTCDate() + 6);

  const { results } = await c.env.DB.prepare(
    `SELECT p.data, p.sessione_id AS sessioneId, s.ora_fine AS oraFine
     FROM presenze p
     JOIN sessioni_gruppo s ON s.id = p.sessione_id
     WHERE p.user_id = ? AND p.presenza_richiesta = 1 AND p.data BETWEEN ? AND ?
       AND NOT EXISTS (
         SELECT 1 FROM feedback_allenamento f
         WHERE f.user_id = p.user_id AND f.sessione_id = p.sessione_id AND f.data = p.data
       )
     ORDER BY p.data`
  )
    .bind(c.var.user.userId, inizioSett.toISOString().slice(0, 10), fineSett.toISOString().slice(0, 10))
    .all<{ data: string; sessioneId: number; oraFine: string }>();

  const ora = adessoRoma();
  const daDare = results.filter((r) => new Date(`${r.data}T${r.oraFine}:00Z`) <= ora);

  return c.json({ sessioni: daDare.map(({ data, sessioneId }) => ({ data, sessioneId })) });
});

feedback.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono lasciare feedback" }, 403);

  const body = await c.req.json<{
    sessioneId?: number;
    data?: string;
    faccina?: number;
    difficolta?: string;
    nota?: string;
  }>();
  const { sessioneId, data, faccina, difficolta, nota } = body;

  if (!sessioneId || !data || !faccina || !difficolta) {
    return c.json({ error: "Dati mancanti" }, 400);
  }
  if (!FACCE.includes(faccina)) return c.json({ error: "Faccina non valida" }, 400);
  if (!DIFFICOLTA.includes(difficolta)) return c.json({ error: "Difficoltà non valida" }, 400);

  const presenza = await c.env.DB.prepare(
    `SELECT id FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ? AND presenza_richiesta = 1`
  )
    .bind(c.var.user.userId, sessioneId, data)
    .first();
  if (!presenza) return c.json({ error: "Puoi lasciare feedback solo per sessioni a cui hai partecipato" }, 400);

  const sessione = await c.env.DB.prepare(`SELECT ora_fine FROM sessioni_gruppo WHERE id = ?`)
    .bind(sessioneId)
    .first<{ ora_fine: string }>();
  if (sessione && new Date(`${data}T${sessione.ora_fine}:00Z`) > adessoRoma()) {
    return c.json({ error: "Il feedback è disponibile solo dopo la fine della sessione" }, 400);
  }

  const esistente = await c.env.DB.prepare(
    `SELECT id FROM feedback_allenamento WHERE user_id = ? AND sessione_id = ? AND data = ?`
  )
    .bind(c.var.user.userId, sessioneId, data)
    .first();
  if (esistente) return c.json({ error: "Hai già lasciato un feedback per questa sessione" }, 409);

  const prima = await snapshotProgressione(c.env.DB, c.var.user.userId);

  await c.env.DB.prepare(
    `INSERT INTO feedback_allenamento (user_id, sessione_id, data, faccina, difficolta, nota)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(c.var.user.userId, sessioneId, data, faccina, difficolta, nota?.trim() || null)
    .run();

  // +2 punti per il feedback post-allenamento (sistema punti 2026-08).
  await awardXp(c.env.DB, c.var.user.userId, "feedback_allenamento", 2);

  const dopo = await snapshotProgressione(c.env.DB, c.var.user.userId);
  await segnalaAvanzamento(c.env.DB, c.var.user.userId, prima, dopo);

  return c.json({ ok: true }, 201);
});

export default feedback;
