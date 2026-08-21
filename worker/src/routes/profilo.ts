import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { calcolaLivello } from "../lib/livelli";

type Variables = { user: SessionUser };
const profilo = new Hono<{ Bindings: Env; Variables: Variables }>();

profilo.get("/me", requireAuth, async (c) => {
  const userId = c.var.user.userId;

  const [profiloRow, settimane, xp, sfideCompletate] = await Promise.all([
    c.env.DB.prepare(`SELECT nome, cognome, nickname FROM athlete_profile WHERE user_id = ?`)
      .bind(userId)
      .first<{ nome: string; cognome: string; nickname: string | null }>(),
    // Settimane cumulative con almeno una presenza confermata (vedi lib/livelli.ts).
    c.env.DB.prepare(`SELECT COUNT(DISTINCT strftime('%Y-%W', data)) AS n FROM presenze WHERE user_id = ? AND confermata = 1`)
      .bind(userId)
      .first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(xp_assegnati), 0) AS totale FROM xp_log WHERE user_id = ?`)
      .bind(userId)
      .first<{ totale: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM partecipazioni_sfide WHERE user_id = ?`).bind(userId).first<{ n: number }>(),
  ]);

  const settimaneCompletate = settimane?.n ?? 0;

  return c.json({
    nome: profiloRow?.nome ?? null,
    cognome: profiloRow?.cognome ?? null,
    nickname: profiloRow?.nickname ?? null,
    role: c.var.user.role,
    settimaneCompletate,
    livello: calcolaLivello(settimaneCompletate),
    xpTotale: xp?.totale ?? 0,
    sfideCompletate: sfideCompletate?.n ?? 0,
  });
});

export default profilo;
