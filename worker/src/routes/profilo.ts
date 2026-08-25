import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { calcolaLivello } from "../lib/livelli";
import { calcolaAnelli, sessioniSettimanaConStato, weekKey } from "../lib/settimana";

type Variables = { user: SessionUser };
const profilo = new Hono<{ Bindings: Env; Variables: Variables }>();

// Profilo coach: identità + "LA MIA STAGIONE" aggregata sul gruppo — niente livello/scala/
// achievements, quelli sono concetti da atleta (la coach non si allena, non progredisce a livelli).
async function profiloCoach(db: D1Database, userId: number) {
  const [profiloRow, atletiTotali, sessioniTotali, dateAllenamenti] = await Promise.all([
    db.prepare(`SELECT nome, cognome, nickname, bio FROM athlete_profile WHERE user_id = ?`)
      .bind(userId)
      .first<{ nome: string | null; cognome: string | null; nickname: string | null; bio: string | null }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'atleta' AND status = 'attivo'`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM presenze WHERE confermata = 1`).first<{ n: number }>(),
    db.prepare(`SELECT DISTINCT data FROM presenze WHERE confermata = 1`).all<{ data: string }>(),
  ]);

  const settimaneProgramma = new Set(
    dateAllenamenti.results.map((r) => weekKey(new Date(`${r.data}T00:00:00Z`)))
  ).size;

  return {
    nome: profiloRow?.nome ?? null,
    cognome: profiloRow?.cognome ?? null,
    nickname: profiloRow?.nickname ?? null,
    bio: profiloRow?.bio ?? null,
    role: "coach" as const,
    stagione: {
      atletiTotali: atletiTotali?.n ?? 0,
      settimaneProgramma,
      sessioniTotali: sessioniTotali?.n ?? 0,
    },
  };
}

profilo.get("/me", requireAuth, async (c) => {
  const userId = c.var.user.userId;

  if (c.var.user.role === "coach") {
    return c.json(await profiloCoach(c.env.DB, userId));
  }

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

// Bio della coach (identità pubblica, sez. Profilo) — upsert perché non tutti gli account
// coach hanno già una riga in athlete_profile (quella tabella nasce per gli atleti).
profilo.post("/bio", requireCoach, async (c) => {
  const { bio } = await c.req.json<{ bio?: string }>();

  await c.env.DB.prepare(
    `INSERT INTO athlete_profile (user_id, nome, cognome, bio) VALUES (?, '', '', ?)
     ON CONFLICT (user_id) DO UPDATE SET bio = excluded.bio`
  )
    .bind(c.var.user.userId, bio?.trim() || null)
    .run();

  return c.json({ ok: true });
});

export default profilo;
