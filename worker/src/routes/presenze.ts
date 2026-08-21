import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { awardXp } from "../lib/xp";

type Variables = { user: SessionUser };
const presenze = new Hono<{ Bindings: Env; Variables: Variables }>();

// Presenza è solo per il giorno stesso, niente prenotazioni future (brief, sezione 3).
// Nota: giorno/data calcolati sull'ora del Worker (UTC), non sul fuso di Roma —
// da rivedere se il disallineamento vicino a mezzanotte diventa un problema reale.
function oggi(): { data: string; giornoSettimana: number } {
  const now = new Date();
  const data = now.toISOString().slice(0, 10);
  const giornoSettimana = ((now.getUTCDay() + 6) % 7) + 1; // 1=lunedì ... 7=domenica
  return { data, giornoSettimana };
}

presenze.get("/oggi", requireAuth, async (c) => {
  const { data, giornoSettimana } = oggi();

  const sessione = await c.env.DB.prepare(
    `SELECT id, ora_inizio, ora_fine, tipo_sessione FROM sessioni_gruppo WHERE giorno_settimana = ?`
  )
    .bind(giornoSettimana)
    .first<{ id: number; ora_inizio: string; ora_fine: string; tipo_sessione: string }>();

  if (!sessione) return c.json({ sessione: null, confermata: false, inSala: [] });

  const [mia, inSala] = await Promise.all([
    c.env.DB.prepare(`SELECT confermata FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ?`)
      .bind(c.var.user.userId, sessione.id, data)
      .first<{ confermata: number }>(),
    // "In The Room": community pubblica di chi si allena oggi, con nome (brief, sezione 7).
    c.env.DB.prepare(
      `SELECT p.nome, p.nickname
       FROM presenze pr
       JOIN athlete_profile p ON p.user_id = pr.user_id
       WHERE pr.sessione_id = ? AND pr.data = ? AND pr.confermata = 1
       ORDER BY p.nome`
    )
      .bind(sessione.id, data)
      .all<{ nome: string; nickname: string | null }>(),
  ]);

  return c.json({ sessione, confermata: !!mia?.confermata, inSala: inSala.results });
});

presenze.post("/conferma", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") {
    return c.json({ error: "Solo gli atleti possono confermare la presenza" }, 403);
  }

  const { data, giornoSettimana } = oggi();

  const sessione = await c.env.DB.prepare(`SELECT id FROM sessioni_gruppo WHERE giorno_settimana = ?`)
    .bind(giornoSettimana)
    .first<{ id: number }>();

  if (!sessione) return c.json({ error: "Nessuna sessione oggi" }, 400);

  const esistente = await c.env.DB.prepare(
    `SELECT confermata FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ?`
  )
    .bind(c.var.user.userId, sessione.id, data)
    .first<{ confermata: number }>();

  if (esistente?.confermata) return c.json({ ok: true });

  await c.env.DB.prepare(
    `INSERT INTO presenze (user_id, sessione_id, data, confermata) VALUES (?, ?, ?, 1)
     ON CONFLICT (user_id, sessione_id, data) DO UPDATE SET confermata = 1`
  )
    .bind(c.var.user.userId, sessione.id, data)
    .run();

  // +10 XP per sessione completata (brief, sezione 4) — assegnato una sola volta alla conferma.
  await awardXp(c.env.DB, c.var.user.userId, "sessione_completata", 10);

  return c.json({ ok: true });
});

export default presenze;
