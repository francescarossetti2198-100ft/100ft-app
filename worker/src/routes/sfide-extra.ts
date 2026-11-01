import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { adessoRoma } from "../lib/oggi";
import { salvaFoto } from "../lib/storage";
import { awardXp } from "../lib/xp";

// Box "Sfide punti extra" della pagina Sfide (vedi migrazione 0046): la coach le scrive
// mese per mese, gli atleti le leggono. Non contano mai per la coccarda. Di solito non si
// "completano" in app (i punti arrivano dal bonus settimana completa o da "Punti extra"),
// tranne quelle "a foto" (migrazione 0050, es. il trekking del 18/10): dentro la finestra
// aperta_dal–aperta_fino l'atleta carica la foto → +punti e post nel Feed.
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
  foto: number;
  apertaDal: string | null;
  apertaFino: string | null;
  fatta: number;
};

// Stesso anti-spoiler delle sfide: l'atleta vede i mesi già iniziati o col programma
// pubblicato; la coach vede tutto.
sfideExtra.get("/", requireAuth, async (c) => {
  const isCoach = c.var.user.role === "coach";
  const meseOggi = adessoRoma().toISOString().slice(0, 7);
  const { results } = await c.env.DB.prepare(
    `SELECT id, anno, mese, titolo, descrizione, punti, data, foto,
            aperta_dal AS apertaDal, aperta_fino AS apertaFino,
            EXISTS (SELECT 1 FROM partecipazioni_sfide_extra p
                    WHERE p.sfida_extra_id = sfide_extra.id AND p.user_id = ?) AS fatta
     FROM sfide_extra
     ${isCoach ? "" : `WHERE printf('%04d-%02d', anno, mese) <= ? OR printf('%04d-%02d', anno, mese) IN
       (SELECT printf('%04d-%02d', anno, mese) FROM programma_mensile WHERE pubblicato = 1)`}
     ORDER BY anno, mese, COALESCE(data, ''), id`
  )
    .bind(c.var.user.userId, ...(isCoach ? [] : [meseOggi]))
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

// Sfida extra a foto: l'atleta carica la foto dentro la finestra di giorni → punti (con il
// titolo come motivo, così la notifica dice il perché) e post nel Feed. Una volta sola.
sfideExtra.post("/:id/partecipa", requireAuth, async (c) => {
  const id = Number(c.req.param("id"));
  const sfida = await c.env.DB.prepare(
    `SELECT id, titolo, punti, foto, aperta_dal AS apertaDal, aperta_fino AS apertaFino FROM sfide_extra WHERE id = ?`
  )
    .bind(id)
    .first<{ id: number; titolo: string; punti: number | null; foto: number; apertaDal: string | null; apertaFino: string | null }>();
  if (!sfida || !sfida.foto) return c.json({ error: "Sfida non trovata" }, 404);

  const oggi = adessoRoma().toISOString().slice(0, 10);
  if (sfida.apertaDal && sfida.apertaDal > oggi) return c.json({ error: "La sfida non è ancora iniziata" }, 400);
  if (sfida.apertaFino && sfida.apertaFino < oggi) return c.json({ error: "Sfida terminata" }, 400);

  const body = await c.req.parseBody();
  const foto = body.foto instanceof File ? body.foto : null;
  if (!foto) return c.json({ error: "Carica una foto per completare la sfida" }, 400);

  const gia = await c.env.DB.prepare(`SELECT 1 FROM partecipazioni_sfide_extra WHERE sfida_extra_id = ? AND user_id = ?`)
    .bind(id, c.var.user.userId)
    .first();
  if (gia) return c.json({ error: "Hai già completato questa sfida" }, 409);

  const fotoUrl = await salvaFoto(c.env.FOTO_SFIDE, "sfide", foto);
  // INSERT OR IGNORE sulla chiave (sfida, utente): due tap ravvicinati non danno punti doppi.
  const ins = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO partecipazioni_sfide_extra (sfida_extra_id, user_id, foto_url) VALUES (?, ?, ?)`
  )
    .bind(id, c.var.user.userId, fotoUrl)
    .run();
  if ((ins.meta.changes ?? 0) === 0) return c.json({ error: "Hai già completato questa sfida" }, 409);

  if (sfida.punti) await awardXp(c.env.DB, c.var.user.userId, `sfida_extra_${id}`, sfida.punti, undefined, sfida.titolo);
  await c.env.DB.prepare(`INSERT INTO post_feed (user_id, tipo, contenuto_url, testo) VALUES (?, 'sfida', ?, ?)`)
    .bind(c.var.user.userId, fotoUrl, sfida.titolo)
    .run();

  return c.json({ ok: true, completata: true });
});

sfideExtra.delete("/:id", requireCoach, async (c) => {
  await c.env.DB.prepare(`DELETE FROM sfide_extra WHERE id = ?`).bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

export default sfideExtra;
