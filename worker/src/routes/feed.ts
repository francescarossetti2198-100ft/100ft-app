import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";

const EMOJI_VALIDE = ["👍", "🔥", "💪", "🎉"];

type Variables = { user: SessionUser };
const feed = new Hono<{ Bindings: Env; Variables: Variables }>();

feed.get("/", requireAuth, async (c) => {
  const { results: posts } = await c.env.DB.prepare(
    `SELECT p.id, p.tipo, p.testo, p.contenuto_url AS contenutoUrl,
            p.allegato_url AS allegatoUrl, p.allegato_nome AS allegatoNome,
            p.data, a.nome, a.nickname
     FROM post_feed p
     LEFT JOIN athlete_profile a ON a.user_id = p.user_id
     ORDER BY p.data DESC
     LIMIT 50`
  ).all<{
    id: number;
    tipo: string;
    testo: string;
    contenutoUrl: string | null;
    allegatoUrl: string | null;
    allegatoNome: string | null;
    data: string;
    nome: string | null;
    nickname: string | null;
  }>();

  const { results: reazioni } = await c.env.DB.prepare(
    `SELECT post_id AS postId, emoji, COUNT(*) AS n,
            MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mia
     FROM feed_reazioni
     WHERE post_id IN (SELECT id FROM post_feed ORDER BY data DESC LIMIT 50)
     GROUP BY post_id, emoji`
  )
    .bind(c.var.user.userId)
    .all<{ postId: number; emoji: string; n: number; mia: number }>();

  const reazioniPerPost = new Map<number, { emoji: string; n: number; mia: boolean }[]>();
  for (const r of reazioni) {
    const lista = reazioniPerPost.get(r.postId) ?? [];
    lista.push({ emoji: r.emoji, n: r.n, mia: !!r.mia });
    reazioniPerPost.set(r.postId, lista);
  }

  return c.json({
    posts: posts.map((p) => ({ ...p, reazioni: reazioniPerPost.get(p.id) ?? [] })),
  });
});

// Toggle: se l'utente ha già reagito con questa emoji la rimuove, altrimenti la aggiunge.
feed.post("/:id/reazioni", requireAuth, async (c) => {
  const postId = Number(c.req.param("id"));
  const { emoji } = await c.req.json<{ emoji?: string }>();
  if (!emoji || !EMOJI_VALIDE.includes(emoji)) return c.json({ error: "Emoji non valida" }, 400);

  const esistente = await c.env.DB.prepare(
    `SELECT id FROM feed_reazioni WHERE post_id = ? AND user_id = ? AND emoji = ?`
  )
    .bind(postId, c.var.user.userId, emoji)
    .first<{ id: number }>();

  if (esistente) {
    await c.env.DB.prepare(`DELETE FROM feed_reazioni WHERE id = ?`).bind(esistente.id).run();
    return c.json({ ok: true, azione: "rimossa" });
  }

  await c.env.DB.prepare(`INSERT INTO feed_reazioni (post_id, user_id, emoji) VALUES (?, ?, ?)`)
    .bind(postId, c.var.user.userId, emoji)
    .run();

  return c.json({ ok: true, azione: "aggiunta" });
});

// Annunci del coach — post manuale (brief, sezione 11), user_id NULL.
feed.post("/annuncio", requireCoach, async (c) => {
  const { testo } = await c.req.json<{ testo?: string }>();
  if (!testo?.trim()) return c.json({ error: "Testo obbligatorio" }, 400);

  await c.env.DB.prepare(`INSERT INTO post_feed (user_id, tipo, testo) VALUES (NULL, 'annuncio_coach', ?)`)
    .bind(testo.trim())
    .run();

  return c.json({ ok: true }, 201);
});

export default feed;
