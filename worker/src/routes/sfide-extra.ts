import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { adessoRoma } from "../lib/oggi";

// Box "Sfide punti extra" della pagina Sfide (vedi migrazione 0046): la coach le scrive
// mese per mese, gli atleti le leggono. Non si "completano" in app e non contano per la
// coccarda: i punti arrivano dal bonus settimana completa o da "Punti extra".
type Variables = { user: SessionUser };
const sfideExtra = new Hono<{ Bindings: Env; Variables: Variables }>();

type Riga = {
  id: number;
  anno: number;
  mese: number;
  titolo: string;
  descrizione: string | null;
  punti: number | null;
  data: string | null;
};

// Stesso anti-spoiler delle sfide: l'atleta vede i mesi già iniziati o col programma
// pubblicato; la coach vede tutto.
sfideExtra.get("/", requireAuth, async (c) => {
  const isCoach = c.var.user.role === "coach";
  const meseOggi = adessoRoma().toISOString().slice(0, 7);
  const { results } = await c.env.DB.prepare(
    `SELECT id, anno, mese, titolo, descrizione, punti, data FROM sfide_extra
     ${isCoach ? "" : `WHERE printf('%04d-%02d', anno, mese) <= ? OR printf('%04d-%02d', anno, mese) IN
       (SELECT printf('%04d-%02d', anno, mese) FROM programma_mensile WHERE pubblicato = 1)`}
     ORDER BY anno, mese, COALESCE(data, ''), id`
  )
    .bind(...(isCoach ? [] : [meseOggi]))
    .all<Riga>();
  return c.json({ sfideExtra: results });
});

sfideExtra.post("/", requireCoach, async (c) => {
  const body = await c.req
    .json<{ anno?: number; mese?: number; titolo?: string; descrizione?: string; punti?: number | null; data?: string | null }>()
    .catch(() => ({}) as Record<string, never>);
  const anno = Number(body.anno);
  const mese = Number(body.mese);
  const titolo = (body.titolo ?? "").trim();
  const punti = body.punti == null ? null : Number(body.punti);
  const data = body.data || null;

  if (!titolo) return c.json({ error: "Il titolo è obbligatorio" }, 400);
  if (!Number.isInteger(anno) || !Number.isInteger(mese) || mese < 1 || mese > 12) {
    return c.json({ error: "Mese non valido" }, 400);
  }
  if (punti != null && (!Number.isInteger(punti) || punti < 1 || punti > 100)) {
    return c.json({ error: "I punti devono essere tra 1 e 100" }, 400);
  }
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return c.json({ error: "Data non valida" }, 400);

  const r = await c.env.DB.prepare(
    `INSERT INTO sfide_extra (anno, mese, titolo, descrizione, punti, data) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(anno, mese, titolo, body.descrizione?.trim() || null, punti, data)
    .run();
  return c.json({ id: r.meta.last_row_id }, 201);
});

sfideExtra.delete("/:id", requireCoach, async (c) => {
  await c.env.DB.prepare(`DELETE FROM sfide_extra WHERE id = ?`).bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

export default sfideExtra;
