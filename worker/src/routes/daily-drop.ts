import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { salvaFoto } from "../lib/storage";
import { oggi as oggiInfo } from "../lib/oggi";
import { orarioDailyDrop, minutiOra } from "../lib/dailyDropOrario";

// Daily Drop (ex "Ricordati di bere", brief sezione 8) — stile BeReal, foto obbligatoria.
// Solo in occasione dei giorni di allenamento (lun/mer/ven), e non ogni volta — occasionale,
// non un appuntamento fisso — a un orario "casuale" ma mai durante la sessione, uguale per
// tutti (vedi lib/dailyDropOrario.ts). L'endpoint non rivela mai l'orario esatto: prima che
// scatti dice solo "non ancora", altrimenti si perde l'effetto sorpresa.
//
// Nota di scope: qui c'è il nucleo completo della logica (giorno giusto, orario giusto,
// niente durante l'allenamento, foto -> XP -> feed, una risposta al giorno) ma NON la vera
// notifica push — richiede un Cron Trigger o Durable Object lato Worker per svegliare il
// client, cosa che il brief stesso segnala come "da progettare". Per ora, una volta scattato
// l'orario, il Daily Drop resta disponibile finché l'atleta non apre l'app (niente
// finestra rigida di 5 minuti, che senza notifica sarebbe quasi impossibile da rispettare).
// Anche la fotocamera doppia (foto + selfie in overlay) resta semplificata a una singola foto.
type Variables = { user: SessionUser };
const dailyDrop = new Hono<{ Bindings: Env; Variables: Variables }>();

function attivoOra(): boolean {
  const { data, giornoSettimana } = oggiInfo();
  const orarioScatto = orarioDailyDrop(data, giornoSettimana);
  if (orarioScatto === null) return false; // oggi non è previsto (giorno sbagliato, o "non tocca")
  return minutiOra(new Date()) >= orarioScatto;
}

dailyDrop.get("/oggi", requireAuth, async (c) => {
  const { data, giornoSettimana } = oggiInfo();
  const previsto = orarioDailyDrop(data, giornoSettimana) !== null;

  const [mia, conteggio] = await Promise.all([
    c.env.DB.prepare(`SELECT id FROM post_feed WHERE tipo = 'daily_drop' AND user_id = ? AND date(data) = ?`)
      .bind(c.var.user.userId, data)
      .first(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM post_feed WHERE tipo = 'daily_drop' AND date(data) = ?`)
      .bind(data)
      .first<{ n: number }>(),
  ]);

  return c.json({
    previsto,
    attivo: previsto && attivoOra(),
    risposta: !!mia,
    numeroRisposte: conteggio?.n ?? 0,
  });
});

dailyDrop.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono rispondere" }, 403);
  if (!attivoOra()) return c.json({ error: "Il Daily Drop non è ancora arrivato oggi" }, 400);

  const { data } = oggiInfo();
  const esistente = await c.env.DB.prepare(
    `SELECT id FROM post_feed WHERE tipo = 'daily_drop' AND user_id = ? AND date(data) = ?`
  )
    .bind(c.var.user.userId, data)
    .first();
  if (esistente) return c.json({ error: "Hai già risposto al Daily Drop di oggi" }, 409);

  const body = await c.req.parseBody();
  const foto = body.foto instanceof File ? body.foto : null;
  if (!foto) return c.json({ error: "Serve una foto per rispondere" }, 400);

  const fotoUrl = await salvaFoto(c.env.FOTO_SFIDE, "daily-drop", foto);

  await c.env.DB.prepare(`INSERT INTO post_feed (user_id, tipo, contenuto_url, testo) VALUES (?, 'daily_drop', ?, ?)`)
    .bind(c.var.user.userId, fotoUrl, "ha risposto al Daily Drop")
    .run();

  // +5 punti alla pubblicazione (sistema punti 2026-08).
  await awardXp(c.env.DB, c.var.user.userId, "daily_drop", 5);

  return c.json({ ok: true }, 201);
});

export default dailyDrop;
