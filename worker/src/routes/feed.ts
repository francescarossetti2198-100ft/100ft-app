import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { parseFotoPersonalizzazione } from "../lib/fotoPersonalizzazione";

const EMOJI_VALIDE = ["👍", "🔥", "💪", "🎉"];

type Variables = { user: SessionUser };
const feed = new Hono<{ Bindings: Env; Variables: Variables }>();

feed.get("/", requireAuth, async (c) => {
  // Filtri opzionali:
  //  ?userId=N -> solo i post di quell'atleta (feed della sua scheda pubblica)
  //  ?q=testo  -> ricerca: testo del post, nome/nickname dell'autore, o "coach" per i
  //               post della coach (annunci + diario, che hanno user_id NULL)
  const userIdFiltro = c.req.query("userId");
  const q = (c.req.query("q") ?? "").trim();

  const condizioni: string[] = [];
  const parametri: unknown[] = [];

  if (userIdFiltro && /^\d+$/.test(userIdFiltro)) {
    condizioni.push("p.user_id = ?");
    parametri.push(Number(userIdFiltro));
  }
  if (q) {
    const like = `%${q}%`;
    condizioni.push(
      "(p.testo LIKE ? OR a.nome LIKE ? OR a.nickname LIKE ? OR (p.user_id IS NULL AND ? LIKE '%coach%'))"
    );
    parametri.push(like, like, like, q.toLowerCase());
  }

  const whereSql = condizioni.length ? `WHERE ${condizioni.join(" AND ")}` : "";

  const { results: posts } = await c.env.DB.prepare(
    `SELECT p.id, p.tipo, p.testo, p.contenuto_url AS contenutoUrl,
            p.allegato_url AS allegatoUrl, p.allegato_nome AS allegatoNome,
            p.data, p.user_id AS userId, a.nome, a.nickname,
            a.foto_url AS fotoUrl, a.foto_personalizzazione AS fotoPersonalizzazione
     FROM post_feed p
     LEFT JOIN athlete_profile a ON a.user_id = p.user_id
     ${whereSql}
     ORDER BY p.data DESC
     LIMIT 50`
  )
    .bind(...parametri)
    .all<{
      id: number;
      tipo: string;
      testo: string;
      contenutoUrl: string | null;
      allegatoUrl: string | null;
      allegatoNome: string | null;
      data: string;
      userId: number | null;
      nome: string | null;
      nickname: string | null;
      fotoUrl: string | null;
      fotoPersonalizzazione: string | null;
    }>();

  const idPost = posts.map((p) => p.id);
  const reazioniPerPost = new Map<number, { emoji: string; n: number; mia: boolean }[]>();

  if (idPost.length) {
    const segnaposto = idPost.map(() => "?").join(",");
    const { results: reazioni } = await c.env.DB.prepare(
      `SELECT post_id AS postId, emoji, COUNT(*) AS n,
              MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mia
       FROM feed_reazioni
       WHERE post_id IN (${segnaposto})
       GROUP BY post_id, emoji`
    )
      .bind(c.var.user.userId, ...idPost)
      .all<{ postId: number; emoji: string; n: number; mia: number }>();

    for (const r of reazioni) {
      const lista = reazioniPerPost.get(r.postId) ?? [];
      lista.push({ emoji: r.emoji, n: r.n, mia: !!r.mia });
      reazioniPerPost.set(r.postId, lista);
    }
  }

  return c.json({
    posts: posts.map((p) => ({
      ...p,
      fotoPersonalizzazione: parseFotoPersonalizzazione(p.fotoPersonalizzazione),
      reazioni: reazioniPerPost.get(p.id) ?? [],
    })),
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
