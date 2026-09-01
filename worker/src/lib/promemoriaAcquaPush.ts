import type { Env } from "../types";
import { sendWebPush } from "./webPush";

// Data/ora "adesso" nel fuso di Roma — come in lib/promemoriaPush.ts (l'orario esatto conta).
function oraRoma(): { data: string; oraMinuti: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { data: `${get("year")}-${get("month")}-${get("day")}`, oraMinuti: `${get("hour")}:${get("minute")}` };
}

const ORARI = ["11:00", "16:00"];

// Promemoria "bevi un po' d'acqua" — due volte al giorno, solo agli atleti che l'hanno
// attivato dal profilo (notifiche_preferenze.promemoria_acqua). Dedup per orario.
export async function inviaPromemoriaAcquaSeAttivo(env: Env): Promise<void> {
  const { data, oraMinuti } = oraRoma();
  if (!ORARI.includes(oraMinuti)) return;

  const chiave = `${data} ${oraMinuti}`;
  const inserito = await env.DB.prepare(`INSERT OR IGNORE INTO acqua_notifiche (chiave) VALUES (?)`)
    .bind(chiave)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già inviato per questo orario

  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     JOIN notifiche_preferenze np ON np.user_id = ps.user_id
     WHERE u.role = 'atleta' AND u.status = 'attivo' AND np.promemoria_acqua = 1`
  ).all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          { title: "100FT — Bevi un po' d'acqua 💧", body: "Promemoria: fermati un attimo e bevi.", url: "/" }
        );
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(s.id).run();
        }
      } catch {
        // Un singolo invio fallito non deve bloccare gli altri.
      }
    })
  );
}
