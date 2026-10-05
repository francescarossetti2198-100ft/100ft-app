import type { Env } from "../types";
import { oggi, adessoRoma } from "./oggi";
import { orarioDailyDrop, minutiOra, FINESTRA_RISPOSTA_MIN } from "./dailyDropOrario";
import { sendWebPush } from "./webPush";

type Iscrizione = { id: number; endpoint: string; p256dh: string; auth: string };

// Payload del push del Daily Drop (usato anche dalla simulazione della coach). `tag` fa sì che
// il push di chiusura sostituisca questa notifica invece di aggiungersi; `scadeAlle` (epoch ms)
// serve al service worker se il push arriva in ritardo, a finestra già chiusa: in quel caso
// mostra direttamente "Daily Drop chiuso" invece dell'invito a rispondere.
export function payloadDailyDrop(scadeAlle: number) {
  return {
    title: "📸 100FT — Daily Drop!",
    body: `È il momento: bevi un sorso e condividi SUBITO la foto. Hai ${FINESTRA_RISPOSTA_MIN} minuti per rispondere ⏱️`,
    url: "/",
    tag: "daily-drop",
    tipo: "daily-drop",
    scadeAlle,
  };
}

const PAYLOAD_CHIUSURA = {
  title: "100FT — Daily Drop chiuso",
  body: "Il Daily Drop di oggi è finito ⏱ Al prossimo!",
  url: "/",
  tag: "daily-drop",
  tipo: "daily-drop-chiuso",
};

async function inviaA(env: Env, iscrizioni: Iscrizione[], payload: Parameters<typeof sendWebPush>[3], ttl: number): Promise<void> {
  await Promise.all(
    iscrizioni.map(async (s) => {
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          payload,
          ttl
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

// Chiamata dal Cron Trigger (ogni minuto, vedi wrangler.toml [triggers]) — manda il push del
// Daily Drop appena scatta l'orario del giorno, una sola volta (daily_drop_notifiche evita
// di rispedirlo ad ogni tick successivo dello stesso giorno). A finestra chiusa manda, a chi
// non ha risposto, il push "Daily Drop chiuso" che prende il posto della notifica rimasta.
export async function inviaDailyDropSeAttivo(env: Env): Promise<void> {
  const { data, giornoSettimana } = oggi();
  const orarioScatto = orarioDailyDrop(data, giornoSettimana);
  if (orarioScatto === null) return; // oggi non previsto
  const ora = minutiOra();
  if (ora < orarioScatto) return; // non è ancora ora

  if (ora >= orarioScatto + FINESTRA_RISPOSTA_MIN) {
    await inviaChiusura(env, data);
    return;
  }

  const inserito = await env.DB.prepare(`INSERT OR IGNORE INTO daily_drop_notifiche (data) VALUES (?)`)
    .bind(data)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già inviato oggi

  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = 'atleta' AND u.status = 'attivo'`
  ).all<Iscrizione>();

  // Istante reale di chiusura della finestra (adessoRoma è un Date "spostato", si usa solo
  // per i secondi trascorsi da mezzanotte di Roma, non come istante).
  const r = adessoRoma();
  const secondiOra = r.getUTCHours() * 3600 + r.getUTCMinutes() * 60 + r.getUTCSeconds();
  const scadeAlle = Date.now() + ((orarioScatto + FINESTRA_RISPOSTA_MIN) * 60 - secondiOra) * 1000;

  // 10 min: il Daily Drop è a tempo, ma tolleri un piccolo ritardo di consegna (se arriva a
  // finestra chiusa il service worker lo mostra già come "chiuso", vedi sw.js).
  await inviaA(env, iscrizioni, payloadDailyDrop(scadeAlle), 600);
}

async function inviaChiusura(env: Env, data: string): Promise<void> {
  // Solo se il push di apertura è partito davvero oggi, e una volta sola.
  const aggiornato = await env.DB.prepare(
    `UPDATE daily_drop_notifiche SET chiusura_inviata = 1 WHERE data = ? AND chiusura_inviata = 0`
  )
    .bind(data)
    .run();
  if ((aggiornato.meta.changes ?? 0) === 0) return;

  // Chi ha risposto ha già toccato la notifica: niente secondo push.
  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = 'atleta' AND u.status = 'attivo'
       AND NOT EXISTS (
         SELECT 1 FROM post_feed pf
         WHERE pf.user_id = u.id AND pf.tipo = 'daily_drop' AND date(pf.data) = ?
       )`
  )
    .bind(data)
    .all<Iscrizione>();

  await inviaA(env, iscrizioni, PAYLOAD_CHIUSURA, 3600);
}
