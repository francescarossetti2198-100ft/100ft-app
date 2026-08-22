import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { salvaFoto } from "../lib/storage";

// Daily Drop (ex "Ricordati di bere", brief sezione 8) — stile BeReal, foto obbligatoria.
// Nota di scope: qui c'è solo il nucleo (foto -> XP -> feed, una risposta al giorno).
// L'orario casuale + finestra di 5 minuti + notifica push richiedono Durable Objects o un
// Cron Trigger lato Worker (il brief stesso lo segnala come "da progettare") — per ora la
// risposta è sempre disponibile, non legata a una notifica. Anche la fotocamera doppia
// (foto + selfie in overlay) è semplificata a una singola foto.
type Variables = { user: SessionUser };
const dailyDrop = new Hono<{ Bindings: Env; Variables: Variables }>();

dailyDrop.get("/oggi", requireAuth, async (c) => {
  const oggi = new Date().toISOString().slice(0, 10);

  const [mia, conteggio] = await Promise.all([
    c.env.DB.prepare(`SELECT id FROM post_feed WHERE tipo = 'daily_drop' AND user_id = ? AND date(data) = ?`)
      .bind(c.var.user.userId, oggi)
      .first(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM post_feed WHERE tipo = 'daily_drop' AND date(data) = ?`)
      .bind(oggi)
      .first<{ n: number }>(),
  ]);

  return c.json({ risposta: !!mia, numeroRisposte: conteggio?.n ?? 0 });
});

dailyDrop.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono rispondere" }, 403);

  const oggi = new Date().toISOString().slice(0, 10);
  const esistente = await c.env.DB.prepare(
    `SELECT id FROM post_feed WHERE tipo = 'daily_drop' AND user_id = ? AND date(data) = ?`
  )
    .bind(c.var.user.userId, oggi)
    .first();
  if (esistente) return c.json({ error: "Hai già risposto al Daily Drop di oggi" }, 409);

  const body = await c.req.parseBody();
  const foto = body.foto instanceof File ? body.foto : null;
  if (!foto) return c.json({ error: "Serve una foto per rispondere" }, 400);

  const fotoUrl = await salvaFoto(c.env.FOTO_SFIDE, "daily-drop", foto);

  await c.env.DB.prepare(`INSERT INTO post_feed (user_id, tipo, contenuto_url, testo) VALUES (?, 'daily_drop', ?, ?)`)
    .bind(c.var.user.userId, fotoUrl, "ha risposto al Daily Drop")
    .run();

  // +10 XP alla pubblicazione (brief, sezione 4 e 8).
  await awardXp(c.env.DB, c.var.user.userId, "daily_drop", 10);

  return c.json({ ok: true }, 201);
});

export default dailyDrop;
