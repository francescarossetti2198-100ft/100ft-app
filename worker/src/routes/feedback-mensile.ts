import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { validaRisposte } from "../lib/questionario";
import { mesePrecedente } from "../lib/oggi";

type Variables = { user: SessionUser };
const feedbackMensile = new Hono<{ Bindings: Env; Variables: Variables }>();

feedbackMensile.get("/stato", requireAuth, async (c) => {
  const { mese, anno } = mesePrecedente();
  const gia = await c.env.DB.prepare(
    `SELECT 1 FROM feedback_mensile WHERE user_id = ? AND mese = ? AND anno = ?`
  )
    .bind(c.var.user.userId, mese, anno)
    .first();
  return c.json({ mese, anno, giaInviato: !!gia });
});

feedbackMensile.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti" }, 403);

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

  return c.json({ ok: true }, 201);
});

export default feedbackMensile;
