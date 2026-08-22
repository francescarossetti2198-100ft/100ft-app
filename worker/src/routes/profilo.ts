import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { calcolaLivello } from "../lib/livelli";
import { calcolaAnelli, sessioniSettimanaConStato } from "../lib/settimana";

type Variables = { user: SessionUser };
const profilo = new Hono<{ Bindings: Env; Variables: Variables }>();

profilo.get("/me", requireAuth, async (c) => {
  const userId = c.var.user.userId;

  const [profiloRow, anelli, punti, sfideCompletate, presenzeTotali, milestones, sessioniSettimana] = await Promise.all([
    c.env.DB.prepare(`SELECT nome, cognome, nickname FROM athlete_profile WHERE user_id = ?`)
      .bind(userId)
      .first<{ nome: string; cognome: string; nickname: string | null }>(),
    calcolaAnelli(c.env.DB, userId),
    c.env.DB.prepare(`SELECT COALESCE(SUM(xp_assegnati), 0) AS totale FROM xp_log WHERE user_id = ?`)
      .bind(userId)
      .first<{ totale: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM partecipazioni_sfide WHERE user_id = ?`).bind(userId).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`).bind(userId).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT tipo, data_raggiunta AS dataRaggiunta FROM milestones WHERE user_id = ? ORDER BY data_raggiunta`)
      .bind(userId)
      .all<{ tipo: string; dataRaggiunta: string }>(),
    sessioniSettimanaConStato(c.env.DB, userId),
  ]);

  return c.json({
    nome: profiloRow?.nome ?? null,
    cognome: profiloRow?.cognome ?? null,
    nickname: profiloRow?.nickname ?? null,
    role: c.var.user.role,
    anelli,
    livello: calcolaLivello(anelli.settimaneCompletateTotali),
    puntiTotali: punti?.totale ?? 0,
    sfideCompletate: sfideCompletate?.n ?? 0,
    presenzeTotali: presenzeTotali?.n ?? 0,
    milestones: milestones.results,
    sessioniSettimana,
  });
});

export default profilo;
