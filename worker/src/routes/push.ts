import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { sendWebPush } from "../lib/webPush";

type Variables = { user: SessionUser };
const push = new Hono<{ Bindings: Env; Variables: Variables }>();

// Chiave pubblica VAPID — il client la usa per iscriversi (PushManager.subscribe).
push.get("/vapid-public-key", requireAuth, async (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY });
});

push.post("/", requireAuth, async (c) => {
  const body = await c.req.json<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>();
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return c.json({ error: "Sottoscrizione non valida" }, 400);

  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  )
    .bind(c.var.user.userId, endpoint, keys.p256dh, keys.auth)
    .run();

  return c.json({ ok: true }, 201);
});

// Promemoria push opzionale (per utente): "bevi acqua" (11:00 e 16:00). La colonna
// notifiche_preferenze.promemoria_merenda resta nello schema ma non è più usata (il
// promemoria merenda è stato tolto: la merenda del giorno esce nel Feed).
push.get("/preferenze", requireAuth, async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT promemoria_acqua AS promemoriaAcqua FROM notifiche_preferenze WHERE user_id = ?`
  )
    .bind(c.var.user.userId)
    .first<{ promemoriaAcqua: number }>();
  return c.json({ promemoriaAcqua: !!row?.promemoriaAcqua });
});

push.post("/preferenze", requireAuth, async (c) => {
  const { promemoriaAcqua } = await c.req.json<{ promemoriaAcqua?: boolean }>();
  await c.env.DB.prepare(
    `INSERT INTO notifiche_preferenze (user_id, promemoria_acqua, promemoria_merenda)
     VALUES (?, ?, 0)
     ON CONFLICT (user_id) DO UPDATE SET
       promemoria_acqua = excluded.promemoria_acqua,
       promemoria_merenda = 0,
       aggiornata_il = datetime('now')`
  )
    .bind(c.var.user.userId, promemoriaAcqua ? 1 : 0)
    .run();
  return c.json({ ok: true });
});

// Notifica di prova verso i propri dispositivi — per verificare che il permesso sia
// concesso e il canale funzioni senza aspettare il Daily Drop o il promemoria del giorno.
push.post("/test", requireAuth, async (c) => {
  const { results: iscrizioni } = await c.env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
  )
    .bind(c.var.user.userId)
    .all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  if (iscrizioni.length === 0) return c.json({ error: "Nessun dispositivo iscritto" }, 400);

  let inviate = 0;
  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          c.env.VAPID_PUBLIC_KEY,
          c.env.VAPID_PRIVATE_KEY,
          { title: "100FT", body: "Notifica di prova — funziona! 🎉", url: "/" }
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

  return c.json({ ok: true, inviate });
});

push.delete("/", requireAuth, async (c) => {
  const { endpoint } = await c.req.json<{ endpoint?: string }>();
  if (!endpoint) return c.json({ error: "Endpoint mancante" }, 400);

  await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`)
    .bind(endpoint, c.var.user.userId)
    .run();

  return c.json({ ok: true });
});

export default push;
