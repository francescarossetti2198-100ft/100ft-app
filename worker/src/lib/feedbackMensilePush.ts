import type { Env } from "../types";
import { sendWebPush } from "./webPush";
import { mesePrecedente } from "./oggi";

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// Data/ora "adesso" nel fuso di Roma (come lib/promemoriaPush.ts) — l'orario esatto del
// promemoria conta, sbagliare fuso vorrebbe dire mandarlo 1-2 ore fuori.
function oraRoma(): { giorno: number; oraMinuti: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { giorno: Number(get("day")), oraMinuti: `${get("hour")}:${get("minute")}` };
}

// Promemoria del questionario mensile — il giorno 1 di ogni mese alle 10:00 (ora di Roma),
// a chi non ha ancora risposto per il mese appena concluso. Una sola volta
// (feedback_mensile_notifiche evita di rispedirlo ai tick successivi).
export async function inviaFeedbackMensileSeAttivo(env: Env): Promise<void> {
  const { giorno, oraMinuti } = oraRoma();
  if (giorno !== 1 || oraMinuti !== "10:00") return;

  const { mese, anno } = mesePrecedente();
  const periodo = `${anno}-${String(mese).padStart(2, "0")}`;

  const inserito = await env.DB.prepare(
    `INSERT OR IGNORE INTO feedback_mensile_notifiche (periodo) VALUES (?)`
  )
    .bind(periodo)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già inviato per questo mese

  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = 'atleta' AND u.status = 'attivo'
       AND NOT EXISTS (
         SELECT 1 FROM feedback_mensile fm
         WHERE fm.user_id = ps.user_id AND fm.mese = ? AND fm.anno = ?
       )`
  )
    .bind(mese, anno)
    .all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          {
            title: "100FT — Com'è andato il mese?",
            body: `Raccontaci com'è andato ${MESI[mese - 1]}: 2 minuti nell'app 📋`,
            url: "/",
          }
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
