import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { oggi } from "../lib/oggi";

type Variables = { user: SessionUser };
const notaCoach = new Hono<{ Bindings: Env; Variables: Variables }>();

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Coach Note: messaggio breve del coach, tono libero, editabile da admin (brief, sezione 7).
// Il coach può prepararle in anticipo per date future (?data=), passando quella data —
// gli atleti vedono sempre e solo la nota di oggi, non possono leggere quelle future.
notaCoach.get("/", requireAuth, async (c) => {
  const richiesta = c.req.query("data");
  const isCoach = c.var.user.role === "coach";
  const data = isCoach && richiesta && DATA_REGEX.test(richiesta) ? richiesta : oggi().data;

  const nota = await c.env.DB.prepare(`SELECT testo FROM nota_coach WHERE data = ?`)
    .bind(data)
    .first<{ testo: string }>();
  return c.json({ testo: nota?.testo ?? null, data });
});

notaCoach.post("/", requireCoach, async (c) => {
  const { testo, data: dataRichiesta } = await c.req.json<{ testo?: string; data?: string }>();
  if (!testo?.trim()) return c.json({ error: "Testo obbligatorio" }, 400);

  const data = dataRichiesta && DATA_REGEX.test(dataRichiesta) ? dataRichiesta : oggi().data;
  await c.env.DB.prepare(
    `INSERT INTO nota_coach (data, testo) VALUES (?, ?)
     ON CONFLICT (data) DO UPDATE SET testo = excluded.testo, aggiornata_il = datetime('now')`
  )
    .bind(data, testo.trim())
    .run();

  return c.json({ ok: true });
});

export default notaCoach;
