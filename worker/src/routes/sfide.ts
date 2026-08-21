import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { awardXp } from "../lib/xp";

type Variables = { user: SessionUser };
const sfide = new Hono<{ Bindings: Env; Variables: Variables }>();

sfide.get("/", requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.titolo, s.descrizione, s.tipo, s.punti, s.data_inizio, s.data_fine,
            EXISTS(SELECT 1 FROM partecipazioni_sfide p WHERE p.sfida_id = s.id AND p.user_id = ?) AS partecipato,
            (SELECT COUNT(*) FROM partecipazioni_sfide p WHERE p.sfida_id = s.id) AS numeroPartecipanti
     FROM sfide s
     ORDER BY s.data_fine DESC`
  )
    .bind(c.var.user.userId)
    .all();

  return c.json({ sfide: results });
});

sfide.post("/:id/partecipa", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") {
    return c.json({ error: "Solo gli atleti possono partecipare alle sfide" }, 403);
  }

  const sfidaId = Number(c.req.param("id"));
  const body = await c.req.json<{ valore?: string }>().catch(() => ({}) as { valore?: string });

  const sfida = await c.env.DB.prepare(`SELECT id, punti, data_fine FROM sfide WHERE id = ?`)
    .bind(sfidaId)
    .first<{ id: number; punti: number; data_fine: string }>();
  if (!sfida) return c.json({ error: "Sfida non trovata" }, 404);

  const oggi = new Date().toISOString().slice(0, 10);
  if (sfida.data_fine < oggi) return c.json({ error: "Sfida terminata" }, 400);

  const esistente = await c.env.DB.prepare(`SELECT id FROM partecipazioni_sfide WHERE sfida_id = ? AND user_id = ?`)
    .bind(sfidaId, c.var.user.userId)
    .first();
  if (esistente) return c.json({ error: "Hai già partecipato a questa sfida" }, 409);

  await c.env.DB.prepare(
    `INSERT INTO partecipazioni_sfide (sfida_id, user_id, valore, data, punti_assegnati) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(sfidaId, c.var.user.userId, body.valore ?? null, oggi, sfida.punti)
    .run();

  await awardXp(c.env.DB, c.var.user.userId, "sfida", sfida.punti);

  return c.json({ ok: true });
});

// Creazione sfida — riservata al coach (brief, sezione 15).
sfide.post("/", requireCoach, async (c) => {
  const body = await c.req.json<{
    titolo?: string;
    descrizione?: string;
    tipo?: string;
    punti?: number;
    data_inizio?: string;
    data_fine?: string;
  }>();
  const { titolo, descrizione, tipo, punti, data_inizio, data_fine } = body;

  if (!titolo || !tipo || !data_inizio || !data_fine) {
    return c.json({ error: "Titolo, tipo, data_inizio e data_fine sono obbligatori" }, 400);
  }
  if (!["presenza", "foto", "valore_manuale"].includes(tipo)) {
    return c.json({ error: "Tipo sfida non valido" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO sfide (titolo, descrizione, tipo, punti, data_inizio, data_fine) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(titolo, descrizione ?? null, tipo, punti ?? 0, data_inizio, data_fine)
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

export default sfide;
