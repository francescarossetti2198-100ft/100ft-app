import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { salvaFoto } from "../lib/storage";
import { oggi as oggiInfo } from "../lib/oggi";
import { statoDailyDrop } from "../lib/dailyDropOrario";
import { sendWebPush } from "../lib/webPush";

// Daily Drop (ex "Ricordati di bere", brief sezione 8) — stile BeReal, foto obbligatoria.
// Solo in occasione dei giorni di allenamento (lun/mer/ven), e non ogni volta — occasionale,
// non un appuntamento fisso — a un orario "casuale" ma mai durante la sessione, uguale per
// tutti (vedi lib/dailyDropOrario.ts). L'endpoint non rivela mai l'orario esatto: prima che
// scatti dice solo "non ancora", altrimenti si perde l'effetto sorpresa.
//
// Nota di scope: qui c'è il nucleo completo della logica (giorno giusto, orario giusto,
// niente durante l'allenamento, foto -> XP -> feed, una risposta al giorno, finestra di
// risposta di FINESTRA_RISPOSTA_MIN minuti dalla notifica) ma NON la vera notifica push —
// richiede un Cron Trigger o Durable Object lato Worker per svegliare il client, cosa che
// il brief stesso segnala come "da progettare". Anche la fotocamera doppia (foto + selfie
// in overlay) resta semplificata a una singola foto.
type Variables = { user: SessionUser };
const dailyDrop = new Hono<{ Bindings: Env; Variables: Variables }>();

// La coach ha aperto una simulazione per questo utente e non è ancora scaduta?
async function simulazioneAttiva(env: Env, userId: number): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 FROM daily_drop_test WHERE user_id = ? AND scade_il > datetime('now')`
  )
    .bind(userId)
    .first();
  return !!row;
}

dailyDrop.get("/oggi", requireAuth, async (c) => {
  const { data, giornoSettimana } = oggiInfo();
  let { previsto, attivo, scaduto } = statoDailyDrop(data, giornoSettimana);

  const [mia, conteggio, simulazione] = await Promise.all([
    c.env.DB.prepare(`SELECT id FROM post_feed WHERE tipo = 'daily_drop' AND user_id = ? AND date(data) = ?`)
      .bind(c.var.user.userId, data)
      .first(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM post_feed WHERE tipo = 'daily_drop' AND date(data) = ?`)
      .bind(data)
      .first<{ n: number }>(),
    simulazioneAttiva(c.env, c.var.user.userId),
  ]);

  // Simulazione: per questo utente il Daily Drop è "attivo" a prescindere dall'orario reale.
  if (simulazione && !mia) {
    previsto = true;
    attivo = true;
    scaduto = false;
  }

  return c.json({
    previsto,
    attivo,
    scaduto,
    risposta: !!mia,
    numeroRisposte: conteggio?.n ?? 0,
  });
});

dailyDrop.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono rispondere" }, 403);
  const { data, giornoSettimana } = oggiInfo();
  const { attivo, scaduto } = statoDailyDrop(data, giornoSettimana);
  const simulazione = await simulazioneAttiva(c.env, c.var.user.userId);

  if (!simulazione) {
    if (scaduto) return c.json({ error: "Il tempo per rispondere al Daily Drop di oggi è scaduto" }, 400);
    if (!attivo) return c.json({ error: "Il Daily Drop non è ancora arrivato oggi" }, 400);
  }

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

  // La simulazione è "usa e getta".
  if (simulazione) {
    await c.env.DB.prepare(`DELETE FROM daily_drop_test WHERE user_id = ?`).bind(c.var.user.userId).run();
  }

  return c.json({ ok: true }, 201);
});

// Simula il Daily Drop per un singolo atleta — solo coach. Apre una finestra di risposta
// di 30 minuti per quell'utente e gli manda la stessa notifica del Daily Drop reale.
dailyDrop.post("/simula", requireCoach, async (c) => {
  const { userId } = await c.req.json<{ userId?: number }>();
  if (!userId) return c.json({ error: "Manca userId" }, 400);

  const atleta = await c.env.DB.prepare(
    `SELECT 1 FROM users WHERE id = ? AND role = 'atleta' AND status = 'attivo'`
  )
    .bind(userId)
    .first();
  if (!atleta) return c.json({ error: "Atleta non trovato" }, 404);

  await c.env.DB.prepare(
    `INSERT INTO daily_drop_test (user_id, scade_il) VALUES (?, datetime('now', '+30 minutes'))
     ON CONFLICT (user_id) DO UPDATE SET scade_il = datetime('now', '+30 minutes')`
  )
    .bind(userId)
    .run();

  const { results: iscrizioni } = await c.env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
  )
    .bind(userId)
    .all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  let inviate = 0;
  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          c.env.VAPID_PUBLIC_KEY,
          c.env.VAPID_PRIVATE_KEY,
          {
            title: "100FT — Daily Drop 💧",
            body: "Fermati e bevi un sorso d'acqua, poi condividi la foto del momento. Apri l'app!",
            url: "/",
          },
          1800
        );
        if (res.status === 404 || res.status === 410) {
          await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(s.id).run();
        } else if (res.ok) {
          inviate++;
        }
      } catch {
        // ignora il singolo invio fallito
      }
    })
  );

  return c.json({ ok: true, inviate, finestraMinuti: 30 });
});

export default dailyDrop;
