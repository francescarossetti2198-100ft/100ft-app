import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";

type Variables = { user: SessionUser };
const messaggi = new Hono<{ Bindings: Env; Variables: Variables }>();

// Lato atleta: la propria conversazione con la coach. Aprirla segna come lette le
// risposte della coach non ancora lette.
messaggi.get("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti hanno questa conversazione" }, 403);

  const atletaId = c.var.user.userId;
  await c.env.DB.prepare(`UPDATE messaggi SET letto = 1 WHERE atleta_id = ? AND mittente_id != ? AND letto = 0`)
    .bind(atletaId, atletaId)
    .run();

  const { results } = await c.env.DB.prepare(
    `SELECT id, mittente_id AS mittenteId, testo, creato_il AS creatoIl FROM messaggi WHERE atleta_id = ? ORDER BY creato_il`
  )
    .bind(atletaId)
    .all();

  return c.json({ messaggi: results.map((m: any) => ({ ...m, daCoach: m.mittenteId !== atletaId })) });
});

messaggi.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono scrivere qui" }, 403);

  const { testo } = await c.req.json<{ testo?: string }>();
  if (!testo?.trim()) return c.json({ error: "Scrivi un messaggio" }, 400);

  await c.env.DB.prepare(`INSERT INTO messaggi (atleta_id, mittente_id, testo) VALUES (?, ?, ?)`)
    .bind(c.var.user.userId, c.var.user.userId, testo.trim())
    .run();

  return c.json({ ok: true }, 201);
});

// Lato coach: elenco atleti con anteprima ultimo messaggio e conteggio non letti, per
// scegliere con chi parlare.
messaggi.get("/atleti", requireCoach, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.user_id AS userId, p.nome, p.nickname,
            (SELECT testo FROM messaggi m WHERE m.atleta_id = p.user_id ORDER BY m.creato_il DESC LIMIT 1) AS ultimoTesto,
            (SELECT creato_il FROM messaggi m WHERE m.atleta_id = p.user_id ORDER BY m.creato_il DESC LIMIT 1) AS ultimoIl,
            (SELECT COUNT(*) FROM messaggi m WHERE m.atleta_id = p.user_id AND m.mittente_id = p.user_id AND m.letto = 0) AS nonLetti
     FROM athlete_profile p
     JOIN users u ON u.id = p.user_id
     WHERE u.role = 'atleta'
     ORDER BY ultimoIl IS NULL, ultimoIl DESC, p.nome`
  ).all();

  return c.json({ atleti: results });
});

// Lato coach: conversazione con un atleta specifico. Aprirla segna come letti i suoi messaggi.
messaggi.get("/:atletaId", requireCoach, async (c) => {
  const atletaId = Number(c.req.param("atletaId"));

  await c.env.DB.prepare(`UPDATE messaggi SET letto = 1 WHERE atleta_id = ? AND mittente_id = ? AND letto = 0`)
    .bind(atletaId, atletaId)
    .run();

  const { results } = await c.env.DB.prepare(
    `SELECT id, mittente_id AS mittenteId, testo, creato_il AS creatoIl FROM messaggi WHERE atleta_id = ? ORDER BY creato_il`
  )
    .bind(atletaId)
    .all();

  return c.json({ messaggi: results.map((m: any) => ({ ...m, daCoach: m.mittenteId !== atletaId })) });
});

messaggi.post("/:atletaId", requireCoach, async (c) => {
  const atletaId = Number(c.req.param("atletaId"));
  const { testo } = await c.req.json<{ testo?: string }>();
  if (!testo?.trim()) return c.json({ error: "Scrivi un messaggio" }, 400);

  const atleta = await c.env.DB.prepare(`SELECT user_id FROM athlete_profile WHERE user_id = ?`)
    .bind(atletaId)
    .first();
  if (!atleta) return c.json({ error: "Atleta non trovato" }, 404);

  await c.env.DB.prepare(`INSERT INTO messaggi (atleta_id, mittente_id, testo) VALUES (?, ?, ?)`)
    .bind(atletaId, c.var.user.userId, testo.trim())
    .run();

  return c.json({ ok: true }, 201);
});

export default messaggi;
