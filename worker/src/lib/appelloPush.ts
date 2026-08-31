import type { Env } from "../types";
import { sendWebPush } from "./webPush";

// Data/ora "adesso" nel fuso di Roma — come in lib/promemoriaPush.ts (l'orario esatto conta).
function oraRoma(): { data: string; oraMinuti: string; giornoSettimana: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const data = `${get("year")}-${get("month")}-${get("day")}`;
  const oraMinuti = `${get("hour")}:${get("minute")}`;
  const giornoJs = new Date(`${data}T00:00:00Z`).getUTCDay();
  const giornoSettimana = giornoJs === 0 ? 7 : giornoJs;
  return { data, oraMinuti, giornoSettimana };
}

// Alla fine di ogni allenamento manda una push al coach: "fai l'appello".
export async function inviaAppelloSeAttivo(env: Env): Promise<void> {
  const { data, oraMinuti, giornoSettimana } = oraRoma();

  const sessione = await env.DB.prepare(
    `SELECT id, ora_fine AS oraFine FROM sessioni_gruppo WHERE giorno_settimana = ?`
  )
    .bind(giornoSettimana)
    .first<{ id: number; oraFine: string }>();
  if (!sessione || sessione.oraFine !== oraMinuti) return;

  const chiuso = await env.DB.prepare(`SELECT 1 FROM giorni_chiusi WHERE data = ?`).bind(data).first();
  if (chiuso) return; // palestra chiusa: nessun appello da fare

  const inserito = await env.DB.prepare(
    `INSERT OR IGNORE INTO appello_notifiche (data, sessione_id) VALUES (?, ?)`
  )
    .bind(data, sessione.id)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già mandata

  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = 'coach'`
  ).all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          { title: "Allenamento finito", body: "Conferma le presenze di oggi 📋", url: "/coach" }
        );
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(s.id).run();
        }
      } catch {
        // un invio fallito non blocca gli altri
      }
    })
  );
}
