import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { pubblicaPost } from "../lib/feed";
import { assegnaMilestone } from "../lib/milestones";

// "max" = più alto è meglio (ripetizioni, tenuta in secondi). "min" = più basso è meglio
// (tempo di percorrenza). Il brief lascia "altro definito dal coach" — non ancora gestibile
// senza Coach Dashboard, quindi per ora solo questi 5 esercizi fissi.
const ESERCIZI: Record<string, "max" | "min"> = {
  "push-ups": "max",
  squat: "max",
  corda: "max",
  plank: "max",
  "1km": "min",
};

type Variables = { user: SessionUser };
const personalBest = new Hono<{ Bindings: Env; Variables: Variables }>();

personalBest.get("/me", requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT esercizio, valore, data, is_new_pb AS isNewPb
     FROM personal_best WHERE user_id = ?
     ORDER BY data DESC`
  )
    .bind(c.var.user.userId)
    .all();

  return c.json({ personalBest: results });
});

personalBest.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono registrare un PB" }, 403);

  const { esercizio, valore } = await c.req.json<{ esercizio?: string; valore?: string }>();
  const direzione = esercizio ? ESERCIZI[esercizio] : undefined;
  if (!esercizio || !direzione) return c.json({ error: "Esercizio non valido" }, 400);

  const valoreNum = valore ? parseFloat(valore.replace(",", ".")) : NaN;
  if (!valore || Number.isNaN(valoreNum)) return c.json({ error: "Inserisci un valore numerico" }, 400);

  const precedente = await c.env.DB.prepare(
    `SELECT valore FROM personal_best WHERE user_id = ? AND esercizio = ? ORDER BY data DESC LIMIT 1`
  )
    .bind(c.var.user.userId, esercizio)
    .first<{ valore: string }>();

  const valorePrecedente = precedente ? parseFloat(precedente.valore) : null;
  const isNewPb =
    valorePrecedente === null || (direzione === "max" ? valoreNum > valorePrecedente : valoreNum < valorePrecedente);

  const oggi = new Date().toISOString().slice(0, 10);
  await c.env.DB.prepare(
    `INSERT INTO personal_best (user_id, esercizio, valore, data, is_new_pb) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(c.var.user.userId, esercizio, valore, oggi, isNewPb ? 1 : 0)
    .run();

  if (isNewPb) {
    // +20 XP per Personal Best (brief, sezione 4) — solo se è un vero miglioramento.
    await awardXp(c.env.DB, c.var.user.userId, "personal_best", 20);
    await pubblicaPost(c.env.DB, c.var.user.userId, "new_pb", `Nuovo PB: ${esercizio} — ${valore}`);
    await assegnaMilestone(c.env.DB, c.var.user.userId, "new_pb");
  }

  return c.json({ ok: true, isNewPb }, 201);
});

export default personalBest;
