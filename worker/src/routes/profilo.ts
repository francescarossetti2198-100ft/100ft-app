import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { calcolaLivello } from "../lib/livelli";
import { calcolaAnelli, sessioniSettimanaConStato } from "../lib/settimana";
import { salvaFoto } from "../lib/storage";

type Variables = { user: SessionUser };
const profilo = new Hono<{ Bindings: Env; Variables: Variables }>();

profilo.get("/me", requireAuth, async (c) => {
  const userId = c.var.user.userId;

  // Profilo coach: niente livello/scala/achievements (la coach non si allena) — il tab
  // Profilo per lei è lo STATO ABBONAMENTI (vedi GET /atleti). Serve però la foto profilo:
  // vale anche per la coach ed è mostrata in classifica accanto al nome.
  if (c.var.user.role === "coach") {
    const row = await c.env.DB.prepare(`SELECT foto_url AS fotoUrl FROM athlete_profile WHERE user_id = ?`)
      .bind(userId)
      .first<{ fotoUrl: string | null }>();
    return c.json({ role: "coach" as const, fotoUrl: row?.fotoUrl ?? null });
  }

  const [profiloRow, anelli, sfideCompletate, presenzeTotali, milestones, sessioniSettimana, posizione] = await Promise.all([
    c.env.DB.prepare(`SELECT nome, cognome, nickname, foto_url AS fotoUrl FROM athlete_profile WHERE user_id = ?`)
      .bind(userId)
      .first<{ nome: string; cognome: string; nickname: string | null; fotoUrl: string | null }>(),
    calcolaAnelli(c.env.DB, userId),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM partecipazioni_sfide WHERE user_id = ?`).bind(userId).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`).bind(userId).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT tipo, data_raggiunta AS dataRaggiunta FROM milestones WHERE user_id = ? ORDER BY data_raggiunta`)
      .bind(userId)
      .all<{ tipo: string; dataRaggiunta: string }>(),
    sessioniSettimanaConStato(c.env.DB, userId),
    // Posizione nella classifica Totale (stessa logica di GET /sfide/classifica?periodo=totale,
    // senza filtro data) — a parità di punti si condivide la stessa posizione.
    c.env.DB.prepare(
      `WITH punti_atleti AS (
         SELECT u.id AS userId, COALESCE(SUM(x.xp_assegnati), 0) AS punti
         FROM users u
         JOIN athlete_profile p ON p.user_id = u.id
         LEFT JOIN xp_log x ON x.user_id = u.id
         WHERE u.role = 'atleta' AND u.status = 'attivo'
         GROUP BY u.id
       )
       SELECT (SELECT COUNT(*) FROM punti_atleti WHERE punti > mio.punti) + 1 AS posizione,
              (SELECT COUNT(*) FROM punti_atleti) AS totaleAtleti,
              mio.punti AS punti
       FROM punti_atleti mio WHERE mio.userId = ?`
    )
      .bind(userId)
      .first<{ posizione: number; totaleAtleti: number; punti: number }>(),
  ]);

  return c.json({
    nome: profiloRow?.nome ?? null,
    cognome: profiloRow?.cognome ?? null,
    nickname: profiloRow?.nickname ?? null,
    fotoUrl: profiloRow?.fotoUrl ?? null,
    role: c.var.user.role,
    anelli,
    livello: calcolaLivello(anelli.settimaneCompletateTotali),
    puntiTotali: posizione?.punti ?? 0,
    classificaTotale: { posizione: posizione?.posizione ?? 1, totaleAtleti: posizione?.totaleAtleti ?? 0 },
    sfideCompletate: sfideCompletate?.n ?? 0,
    presenzeTotali: presenzeTotali?.n ?? 0,
    milestones: milestones.results,
    sessioniSettimana,
  });
});

// Foto profilo — vale per atleti e coach, mostrata anche in classifica (sfide.ts).
profilo.post("/foto", requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = body.foto instanceof File ? body.foto : null;
  if (!file) return c.json({ error: "Serve una foto" }, 400);

  const fotoUrl = await salvaFoto(c.env.FOTO_SFIDE, "profilo", file);

  await c.env.DB.prepare(
    `INSERT INTO athlete_profile (user_id, nome, cognome, foto_url) VALUES (?, '', '', ?)
     ON CONFLICT (user_id) DO UPDATE SET foto_url = excluded.foto_url`
  )
    .bind(c.var.user.userId, fotoUrl)
    .run();

  return c.json({ ok: true, fotoUrl });
});

export default profilo;
