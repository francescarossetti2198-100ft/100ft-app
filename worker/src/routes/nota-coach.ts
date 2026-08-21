import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { oggi } from "../lib/oggi";

type Variables = { user: SessionUser };
const notaCoach = new Hono<{ Bindings: Env; Variables: Variables }>();

// Coach Note: messaggio breve del coach, tono libero, editabile da admin (brief, sezione 7).
notaCoach.get("/", requireAuth, async (c) => {
  const { data } = oggi();
  const nota = await c.env.DB.prepare(`SELECT testo FROM nota_coach WHERE data = ?`)
    .bind(data)
    .first<{ testo: string }>();
  return c.json({ testo: nota?.testo ?? null });
});

notaCoach.post("/", requireCoach, async (c) => {
  const { testo } = await c.req.json<{ testo?: string }>();
  if (!testo?.trim()) return c.json({ error: "Testo obbligatorio" }, 400);

  const { data } = oggi();
  await c.env.DB.prepare(
    `INSERT INTO nota_coach (data, testo) VALUES (?, ?)
     ON CONFLICT (data) DO UPDATE SET testo = excluded.testo, aggiornata_il = datetime('now')`
  )
    .bind(data, testo.trim())
    .run();

  return c.json({ ok: true });
});

export default notaCoach;
