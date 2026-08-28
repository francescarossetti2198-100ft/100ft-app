import type { Env } from "../types";
import { sendWebPush } from "./webPush";

// Data/ora di "adesso" nel fuso di Roma — a differenza di lib/oggi.ts (che usa l'ora UTC del
// Worker, tollerato altrove) qui l'orario esatto (13:00) è il punto della richiesta, sbagliare
// fuso vorrebbe dire mandare il promemoria 1-2 ore fuori orario.
function oggiRoma(): { data: string; oraMinuti: string; giornoSettimana: number } {
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

  const giornoJs = new Date(`${data}T00:00:00Z`).getUTCDay(); // 0=domenica...6=sabato
  const giornoSettimana = giornoJs === 0 ? 7 : giornoJs; // 1=lunedì...7=domenica

  return { data, oraMinuti, giornoSettimana };
}

// Promemoria di registrare la presenza — ogni giorno di allenamento, alle 13:00 (ora di
// Roma), a tutti gli atleti iscritti. Diverso dal Daily Drop: sempre (non ~1 giorno su 3),
// orario fisso.
export async function inviaPromemoriaAllenamentoSeAttivo(env: Env): Promise<void> {
  const { data, oraMinuti, giornoSettimana } = oggiRoma();
  if (oraMinuti !== "13:00") return;

  const sessioneOggi = await env.DB.prepare(`SELECT 1 FROM sessioni_gruppo WHERE giorno_settimana = ? LIMIT 1`)
    .bind(giornoSettimana)
    .first();
  if (!sessioneOggi) return; // oggi non c'è allenamento

  const inserito = await env.DB.prepare(`INSERT OR IGNORE INTO allenamento_notifiche (data) VALUES (?)`)
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
          {
            title: "100FT — Ti alleni oggi?",
            body: "Ricordati di registrare la presenza nell'app 💪",
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
