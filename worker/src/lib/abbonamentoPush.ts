import type { Env } from "../types";
import { sendWebPush } from "./webPush";

// Data/ora "adesso" nel fuso di Roma (come lib/promemoriaPush.ts) — l'orario esatto (18:00)
// è il punto della richiesta, sbagliare fuso vorrebbe dire mandarlo 1-2 ore fuori.
function oraRoma(): { data: string; giorno: number; oraMinuti: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    data: `${g("year")}-${g("month")}-${g("day")}`,
    giorno: Number(g("day")),
    oraMinuti: `${g("hour")}:${g("minute")}`,
  };
}

// Promemoria "salda l'abbonamento del mese" — ogni giorno alle 18:00 (ora di Roma), dalla
// seconda settimana del mese in poi (giorno >= 8), agli atleti che hanno scelto un piano ma
// non hanno ancora il pagamento di questo mese segnato come "pagato" dal coach. Si ferma da
// solo quando il pagamento viene segnato. Dedup una volta al giorno (abbonamento_notifiche).
export async function inviaPromemoriaAbbonamentoSeAttivo(env: Env): Promise<void> {
  const { data, giorno, oraMinuti } = oraRoma();
  if (giorno < 8 || oraMinuti !== "18:00") return;

  const inserito = await env.DB.prepare(
    `INSERT OR IGNORE INTO abbonamento_notifiche (data) VALUES (?)`
  )
    .bind(data)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già inviato oggi

  const [anno, mese] = data.split("-").map(Number);

  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = 'atleta' AND u.status = 'attivo'
       AND EXISTS (SELECT 1 FROM abbonamenti_scelte s WHERE s.user_id = ps.user_id)
       AND NOT EXISTS (
         SELECT 1 FROM pagamenti p
         WHERE p.user_id = ps.user_id AND p.anno = ? AND p.mese = ? AND p.stato = 'pagato'
       )`
  )
    .bind(anno, mese)
    .all<{ id: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          {
            title: "100FT",
            body: "Ricordati di saldare il tuo abbonamento mensile",
            url: "/profilo",
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
