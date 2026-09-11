import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { adessoRoma } from "../lib/oggi";

type Variables = { user: SessionUser };
const chiusure = new Hono<{ Bindings: Env; Variables: Variables }>();

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Giorni di chiusura recenti + futuri (gli atleti li leggono per la timeline "Questa
// settimana"; il coach per gestirli). Niente storico infinito: da 60 giorni fa in avanti.
chiusure.get("/", requireAuth, async (c) => {
  const d = adessoRoma();
  d.setUTCDate(d.getUTCDate() - 60);
  const da = d.toISOString().slice(0, 10);
  const { results } = await c.env.DB.prepare(
    `SELECT data, motivo FROM giorni_chiusi WHERE data >= ? ORDER BY data`
  )
    .bind(da)
    .all<{ data: string; motivo: string | null }>();
  return c.json({ giorni: results });
});

chiusure.post("/", requireCoach, async (c) => {
  const { data, motivo } = await c.req.json<{ data?: string; motivo?: string }>();
  if (!data || !ISO.test(data)) return c.json({ error: "Data non valida" }, 400);
  await c.env.DB.prepare(
    `INSERT INTO giorni_chiusi (data, motivo) VALUES (?, ?)
     ON CONFLICT (data) DO UPDATE SET motivo = excluded.motivo`
  )
    .bind(data, motivo?.trim() || null)
    .run();
  return c.json({ ok: true }, 201);
});

chiusure.delete("/:data", requireCoach, async (c) => {
  const data = c.req.param("data");
  if (!data || !ISO.test(data)) return c.json({ error: "Data non valida" }, 400);
  await c.env.DB.prepare(`DELETE FROM giorni_chiusi WHERE data = ?`).bind(data).run();
  return c.json({ ok: true });
});

export default chiusure;
