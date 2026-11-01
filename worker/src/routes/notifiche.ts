import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { elencoNotifiche, contaNuove, segnaLette, rilevaSorpassi, EMOJI_SORPASSO } from "../lib/notifiche";

// Campanella delle notifiche (solo atleti, niente push) — vedi lib/notifiche.ts.
type Variables = { user: SessionUser };
const notifiche = new Hono<{ Bindings: Env; Variables: Variables }>();

// Numerino rosso sulla campanella.
notifiche.get("/conteggio", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ nuove: 0 });
  await rilevaSorpassi(c.env.DB);
  return c.json({ nuove: await contaNuove(c.env.DB, c.var.user.userId) });
});

// Elenco completo. Chi lo apre ha visto tutto: segna come lette DOPO aver calcolato
// "nuova", così la pagina mostra ancora quali erano le nuove.
notifiche.get("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ notifiche: [] });
  await rilevaSorpassi(c.env.DB);
  const lista = await elencoNotifiche(c.env.DB, c.var.user.userId);
  await segnaLette(c.env.DB, c.var.user.userId);
  return c.json({ notifiche: lista });
});

// Risposta con un'emoji a chi ti ha sorpassato (una sola volta per sorpasso). Arriva a lui
// come notifica.
notifiche.post("/sorpasso/:id/reazione", requireAuth, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Notifica non valida" }, 400);
  const { emoji } = await c.req.json<{ emoji?: string }>();
  if (!emoji || !EMOJI_SORPASSO.includes(emoji)) return c.json({ error: "Emoji non valida" }, 400);

  const sorpasso = await c.env.DB.prepare(
    `SELECT attore_id AS attoreId, reazione FROM notifiche WHERE id = ? AND user_id = ? AND tipo = 'sorpasso'`
  )
    .bind(id, c.var.user.userId)
    .first<{ attoreId: number; reazione: string | null }>();
  if (!sorpasso) return c.json({ error: "Notifica non trovata" }, 404);
  if (sorpasso.reazione) return c.json({ error: "Hai già risposto" }, 409);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE notifiche SET reazione = ? WHERE id = ?`).bind(emoji, id),
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO notifiche (user_id, tipo, attore_id, riferimento_id, reazione, chiave)
       VALUES (?, 'reazione_sorpasso', ?, ?, ?, ?)`
    ).bind(sorpasso.attoreId, c.var.user.userId, id, emoji, `reazione_sorpasso:${id}`),
  ]);

  return c.json({ ok: true }, 201);
});

export default notifiche;
