import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireCoach } from "../middleware/auth";
import { adessoRoma } from "../lib/oggi";
import { PIANI, pianoValido, prezzoPiano, nomePiano } from "../lib/abbonamentiPiani";
import { pianoDelMese } from "../lib/abbonamenti";

type Variables = { user: SessionUser };
const suddivisioni = new Hono<{ Bindings: Env; Variables: Variables }>();

// Vista coach: per un mese, quanto incassa e come si divide con la palestra.
suddivisioni.get("/", requireCoach, async (c) => {
  const ora = adessoRoma();
  const anno = Number(c.req.query("anno")) || ora.getUTCFullYear();
  const mese = Number(c.req.query("mese")) || ora.getUTCMonth() + 1;

  const [{ results: atleti }, { results: pagRows }, { results: cfgRows }] = await Promise.all([
    c.env.DB.prepare(
      `SELECT u.id AS userId, COALESCE(p.nickname, p.nome || ' ' || p.cognome) AS nome
       FROM users u JOIN athlete_profile p ON p.user_id = u.id
       WHERE u.role = 'atleta' AND u.status = 'attivo'
       ORDER BY nome`
    ).all<{ userId: number; nome: string }>(),
    c.env.DB.prepare(`SELECT user_id AS userId, stato, piano FROM pagamenti WHERE anno = ? AND mese = ?`)
      .bind(anno, mese)
      .all<{ userId: number; stato: string; piano: string | null }>(),
    c.env.DB.prepare(`SELECT piano, quota_coach_pct AS pct FROM abbonamenti_suddivisione`).all<{
      piano: string;
      pct: number;
    }>(),
  ]);

  const pagMap = new Map(pagRows.map((r) => [r.userId, r]));
  const cfgMap = new Map(cfgRows.map((r) => [r.piano, r.pct]));

  const righe = [];
  let coach = 0;
  let palestra = 0;
  let daDefinire = 0;

  for (const a of atleti) {
    const pag = pagMap.get(a.userId);
    const piano = pag?.piano ?? (await pianoDelMese(c.env.DB, a.userId, anno, mese));
    if (!piano) continue; // atleta senza abbonamento scelto: non compare

    const prezzo = prezzoPiano(piano) ?? 0;
    const pct = cfgMap.get(piano);
    const quotaCoach = pct != null ? Math.round(prezzo * pct) / 100 : null;
    const quotaPalestra = quotaCoach != null ? prezzo - quotaCoach : null;

    if (quotaCoach != null) {
      coach += quotaCoach;
      palestra += quotaPalestra ?? 0;
    } else {
      daDefinire += prezzo;
    }

    righe.push({
      userId: a.userId,
      nome: a.nome,
      piano,
      nomePiano: nomePiano(piano),
      prezzo,
      stato: pag?.stato ?? "non_pagato",
      quotaCoach,
      quotaPalestra,
    });
  }

  return c.json({
    anno,
    mese,
    righe,
    config: Object.fromEntries(PIANI.map((p) => [p.key, cfgMap.get(p.key) ?? null])),
    totali: { coach, palestra, daDefinire },
  });
});

// Imposta la % che spetta alla coach per un piano (il resto va alla palestra).
suddivisioni.post("/config", requireCoach, async (c) => {
  const { piano, quotaCoachPct } = await c.req.json<{ piano?: string; quotaCoachPct?: number }>();
  if (
    !piano ||
    !pianoValido(piano) ||
    typeof quotaCoachPct !== "number" ||
    quotaCoachPct < 0 ||
    quotaCoachPct > 100
  ) {
    return c.json({ error: "Dati non validi" }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO abbonamenti_suddivisione (piano, quota_coach_pct) VALUES (?, ?)
     ON CONFLICT (piano) DO UPDATE SET quota_coach_pct = excluded.quota_coach_pct`
  )
    .bind(piano, Math.round(quotaCoachPct))
    .run();
  return c.json({ ok: true });
});

export default suddivisioni;
