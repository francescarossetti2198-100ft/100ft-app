import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireCoach } from "../middleware/auth";
import { awardXp } from "../lib/xp";

type Variables = { user: SessionUser };
const puntiExtra = new Hono<{ Bindings: Env; Variables: Variables }>();

// Punti extra assegnati a mano dalla coach (sfide fatte in palestra). Non compaiono nel
// Feed: entrano solo in classifica, che somma tutte le righe di xp_log a prescindere
// dall'azione. `azione = 'punti_extra'` è testo libero (xp_log non ha CHECK) → nessuna
// migrazione. Lo storico serve per annullare un'assegnazione sbagliata.

puntiExtra.get("/", requireCoach, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT x.id, x.xp_assegnati AS punti, x.data,
            p.nome, p.cognome, p.nickname
     FROM xp_log x
     JOIN athlete_profile p ON p.user_id = x.user_id
     WHERE x.azione = 'punti_extra'
     ORDER BY x.id DESC
     LIMIT 30`
  ).all<{ id: number; punti: number; data: string; nome: string; cognome: string | null; nickname: string | null }>();

  return c.json({
    storico: results.map((r) => ({
      id: r.id,
      punti: r.punti,
      data: r.data,
      nome: r.nickname || [r.nome, r.cognome].filter(Boolean).join(" ") || r.nome,
    })),
  });
});

puntiExtra.post("/", requireCoach, async (c) => {
  const { userId, punti } = await c.req.json<{ userId?: number; punti?: number }>();

  if (!Number.isInteger(userId)) return c.json({ error: "Atleta non valido" }, 400);
  if (!Number.isInteger(punti) || (punti as number) < 1 || (punti as number) > 100) {
    return c.json({ error: "I punti devono essere un numero da 1 a 100" }, 400);
  }

  const atleta = await c.env.DB.prepare(
    `SELECT 1 FROM users WHERE id = ? AND role = 'atleta' AND status = 'attivo'`
  )
    .bind(userId)
    .first();
  if (!atleta) return c.json({ error: "Atleta non trovato" }, 404);

  await awardXp(c.env.DB, userId as number, "punti_extra", punti as number);
  return c.json({ ok: true }, 201);
});

puntiExtra.delete("/:id", requireCoach, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "ID non valido" }, 400);

  await c.env.DB.prepare(`DELETE FROM xp_log WHERE id = ? AND azione = 'punti_extra'`)
    .bind(id)
    .run();
  return c.json({ ok: true });
});

export default puntiExtra;
