import type { Env } from "../types";
import { oggi } from "./oggi";
import { orarioDailyDrop, minutiOra } from "./dailyDropOrario";
import { sendWebPush } from "./webPush";

// Chiamata dal Cron Trigger (ogni minuto, vedi wrangler.toml [triggers]) — manda il push del
// Daily Drop appena scatta l'orario del giorno, una sola volta (daily_drop_notifiche evita
// di rispedirlo ad ogni tick successivo dello stesso giorno).
export async function inviaDailyDropSeAttivo(env: Env): Promise<void> {
  const { data, giornoSettimana } = oggi();
  const orarioScatto = orarioDailyDrop(data, giornoSettimana);
  if (orarioScatto === null) return; // oggi non previsto
  if (minutiOra() < orarioScatto) return; // non è ancora ora

  const inserito = await env.DB.prepare(`INSERT OR IGNORE INTO daily_drop_notifiche (data) VALUES (?)`)
    .bind(data)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già inviato oggi

  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = 'atleta' AND u.status = 'attivo'`
  ).all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          { title: "100FT — Daily Drop 💧", body: "Fermati e bevi un sorso d'acqua, poi condividi la foto del momento. Apri l'app!", url: "/" }
        );
        // 404/410 = sottoscrizione scaduta o revocata lato browser, va rimossa.
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(s.id).run();
        }
      } catch {
        // Un singolo invio fallito (rete, endpoint irraggiungibile) non deve bloccare gli altri.
      }
    })
  );
}
