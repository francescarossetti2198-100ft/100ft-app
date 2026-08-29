import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { validaRisposte } from "../lib/questionario";
import { mesePrecedente } from "../lib/oggi";
import { awardXp } from "../lib/xp";

// Punti classifica per aver compilato il feedback del mese.
const XP_FEEDBACK_MENSILE = 15;

// Si compila solo la prima settimana del mese (giorni 1–7), sul mese appena concluso.
function nellaFinestra(): boolean {
  return new Date().getUTCDate() <= 7;
}

type Variables = { user: SessionUser };
const feedbackMensile = new Hono<{ Bindings: Env; Variables: Variables }>();

feedbackMensile.get("/stato", requireAuth, async (c) => {
  const { mese, anno } = mesePrecedente();
  const gia = await c.env.DB.prepare(
    `SELECT 1 FROM feedback_mensile WHERE user_id = ? AND mese = ? AND anno = ?`
  )
    .bind(c.var.user.userId, mese, anno)
    .first();
  return c.json({ mese, anno, giaInviato: !!gia, disponibile: nellaFinestra() });
});

feedbackMensile.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti" }, 403);

  if (!nellaFinestra()) {
    return c.json({ error: "Il feedback del mese si compila entro il giorno 7" }, 409);
  }

  const body = await c.req.json<{ risposte?: unknown }>();
  if (!validaRisposte(body.risposte) || Object.keys(body.risposte).length === 0) {
    return c.json({ error: "Rispondi ad almeno una domanda" }, 400);
  }

  // mese/anno decisi dal server, non dal client.
  const { mese, anno } = mesePrecedente();

  const gia = await c.env.DB.prepare(
    `SELECT 1 FROM feedback_mensile WHERE user_id = ? AND mese = ? AND anno = ?`
  )
    .bind(c.var.user.userId, mese, anno)
    .first();
  if (gia) return c.json({ error: "Hai già inviato il feedback di questo mese" }, 409);

  await c.env.DB.prepare(
    `INSERT INTO feedback_mensile (user_id, mese, anno, risposte) VALUES (?, ?, ?, ?)`
  )
    .bind(c.var.user.userId, mese, anno, JSON.stringify(body.risposte))
    .run();

  await awardXp(c.env.DB, c.var.user.userId, "feedback_mensile", XP_FEEDBACK_MENSILE);

  return c.json({ ok: true, punti: XP_FEEDBACK_MENSILE }, 201);
});

export default feedbackMensile;
