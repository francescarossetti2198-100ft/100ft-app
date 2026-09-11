import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { adessoRoma } from "../lib/oggi";
import { pianoValido } from "../lib/abbonamentiPiani";
import { pianoDelMese, pianoProssimo, meseProssimo } from "../lib/abbonamenti";

type Variables = { user: SessionUser };
const abbonamento = new Hono<{ Bindings: Env; Variables: Variables }>();

// L'atleta sceglie / cambia il suo piano di abbonamento.
// - Prima scelta in assoluto -> vale dal mese corrente (immediata).
// - Cambio -> vale dal mese successivo (il mese in corso resta com'era).
abbonamento.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") {
    return c.json({ error: "Solo gli atleti scelgono l'abbonamento" }, 403);
  }
  const { piano } = await c.req.json<{ piano?: string }>();
  if (!piano || !pianoValido(piano)) {
    return c.json({ error: "Piano non valido" }, 400);
  }
  const userId = c.var.user.userId;

  const gia = await c.env.DB.prepare(`SELECT 1 FROM abbonamenti_scelte WHERE user_id = ? LIMIT 1`)
    .bind(userId)
    .first();

  let anno: number;
  let mese: number;
  if (!gia) {
    const ora = adessoRoma();
    anno = ora.getUTCFullYear();
    mese = ora.getUTCMonth() + 1;
  } else {
    ({ anno, mese } = meseProssimo());
  }

  // UNIQUE(user_id, dal_anno, dal_mese): se cambia due volte per lo stesso mese futuro,
  // l'ultima vince.
  await c.env.DB.prepare(
    `INSERT INTO abbonamenti_scelte (user_id, piano, dal_anno, dal_mese) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, dal_anno, dal_mese) DO UPDATE SET piano = excluded.piano, creato_il = datetime('now')`
  )
    .bind(userId, piano, anno, mese)
    .run();

  const ora = adessoRoma();
  return c.json({
    piano: await pianoDelMese(c.env.DB, userId, ora.getUTCFullYear(), ora.getUTCMonth() + 1),
    pianoProssimo: await pianoProssimo(c.env.DB, userId),
  });
});

export default abbonamento;
