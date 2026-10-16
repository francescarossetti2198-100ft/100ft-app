import type { Env } from "../types";
import { sendWebPush } from "./webPush";

// Frasi d'auguri per il post di compleanno nel Feed — {nome} viene sostituito col nome (o
// nickname) di chi festeggia. Scritte neutre: dal nome non si può sapere il genere. L'età
// non compare mai (scelta di Francesca, ott 2026).
export const FRASI_COMPLEANNO = [
  "Oggi si festeggia {nome}! 🎂 Tanti auguri dalla famiglia 100FT!",
  "Buon compleanno {nome}! 🎉 Un altro anno più forte, più veloce, più 100FT 💪",
  "Candeline accese per {nome} 🕯️ Tanti auguri, che sia un anno pieno di traguardi!",
  "Oggi il WOD più importante lo fa {nome}: spegnere le candeline 🎂 Auguri!",
  "Tanti auguri {nome}! 🥳 Oggi la torta è concessa, parola della coach 🍰",
  "Auguri {nome}! 🎈 Che quest'anno ti porti nuovi record e tanta energia ⚡",
  "Compleanno in palestra: oggi è il giorno di {nome}! 🎉 Fatevi sentire con gli auguri qui sotto 👇",
  "Un anno in più, una ripetizione in più 💪 Buon compleanno {nome}! 🎂",
  "Oggi niente burpees per {nome}… forse 😏 Tantissimi auguri! 🎉",
  "Buon compleanno {nome}! 🎁 Grazie per l'energia che porti ogni volta in sala 🔥",
  "Festa grande oggi: {nome} compie gli anni! 🥳 Lasciate i vostri auguri qui sotto 👇",
  "Auguri {nome}! 🎂 Che sia un anno di sorrisi, sudore e soddisfazioni 💛",
  "Oggi si brinda a {nome} 🥂 Tanti auguri dalla squadra 100FT!",
  "Alert compleanno 🚨 Oggi è il giorno di {nome}! Auguri, auguri, auguri 🎉",
  "Buon compleanno {nome}! 🎂 La tua costanza ci ispira tutti i giorni 💪",
  "{nome}, oggi il recupero è obbligatorio: festeggia alla grande! 🎉 Auguri!",
  "Tanti auguri {nome} 🎈 Che il nuovo anno sia il tuo miglior allenamento di sempre!",
  "Oggi la sala fa il tifo per {nome}! 📣 Buon compleanno 🎂",
  "Auguri {nome}! 🥳 Un anno in più di esperienza, zero anni in meno di grinta 🔥",
  "Buon compleanno {nome}! 🎉 Oggi carico massimo… di torta 🍰",
  "Un grande abbraccio a {nome} che oggi festeggia! 🤗 Tanti auguri dalla famiglia 100FT",
  "Candeline, coriandoli e tanta energia: buon compleanno {nome}! 🎊",
  "Oggi {nome} alza l'asticella di un anno 📈 Tanti auguri! 🎂",
  "Auguri {nome}! 🎁 Il regalo più bello? Un anno pieno di nuovi traguardi 🏆",
  "Si festeggia {nome}! 🥳 Oggi il cardio si fa ballando 💃🕺",
  "Buon compleanno {nome}! 💛 Felici di averti nella squadra 100FT",
  "Oggi è il compleanno di {nome}! 🎂 Chi passa in sala porti gli auguri (e magari una fetta di torta 😉)",
  "Tanti auguri {nome}! 🎉 Che quest'anno ogni allenamento ti faccia sentire invincibile 💪",
  "Auguri {nome}! 🎈 Oggi il personal best è la felicità 😄",
  "Buon compleanno {nome}! 🥂 Un anno nuovo da affrontare con la stessa grinta di sempre 🔥",
  "Oggi la playlist è tutta per {nome} 🎶 Tanti auguri! 🎂",
  "Auguri {nome}! 🎊 Più forte di ieri, meno forte di domani 💪",
  "È il giorno di {nome}! 🎉 Mandiamo un mare di auguri qui sotto 👇",
  "Buon compleanno {nome}! 🎂 Oggi si festeggia, domani si torna a spingere 💪",
  "Tanti auguri {nome} 🥳 Che la forza (e la torta) sia con te 🍰",
  "Auguri {nome}! 🌟 Un anno di nuove sfide ti aspetta, e noi siamo qui a fare il tifo 📣",
  "Oggi {nome} festeggia! 🎈 Un abbraccio grande da tutta la 100FT 🤗",
  "Buon compleanno {nome}! 🎉 Il miglior allenamento è festeggiare chi ci fa ridere in sala 😄",
  "Auguri {nome}! 🎂 Che sia un anno da medaglia d'oro 🥇",
  "Tantissimi auguri {nome}! 🎊 Oggi il riscaldamento è con le candeline 🕯️",
];

function oraRoma(): { data: string; anno: number; ora: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    data: `${get("year")}-${get("month")}-${get("day")}`,
    anno: Number(get("year")),
    ora: Number(get("hour")),
  };
}

const bisestile = (anno: number) => (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;

// Sceglie una frase che questa persona non ha ancora ricevuto negli anni passati (a caso tra
// quelle rimaste); quando le ha avute tutte si ricomincia dal mazzo intero.
function scegliFrase(giaUsate: number[]): number {
  const usate = new Set(giaUsate);
  let libere = FRASI_COMPLEANNO.map((_, i) => i).filter((i) => !usate.has(i));
  if (!libere.length) libere = FRASI_COMPLEANNO.map((_, i) => i);
  return libere[Math.floor(Math.random() * libere.length)];
}

// Dalle 11:00 (ora di Roma) del giorno del compleanno: per ogni iscritto attivo (atleti e
// coach) che compie gli anni oggi pubblica un post nel Feed con la sua foto e una frase
// d'auguri, e manda una push a tutti (al festeggiato una personale). Chi è nato il 29
// febbraio negli anni non bisestili festeggia il 28. Dedup per persona e anno
// (compleanni_feed): basta che il cron giri una volta dopo le 11.
export async function pubblicaCompleanniSeAttivo(env: Env): Promise<void> {
  const { data, anno, ora } = oraRoma();
  if (ora < 11) return;

  const meseGiorno = data.slice(5); // "MM-DD"
  const giorni = [meseGiorno];
  if (meseGiorno === "02-28" && !bisestile(anno)) giorni.push("02-29");

  const { results: festeggiati } = await env.DB.prepare(
    `SELECT u.id AS userId, a.nome, a.nickname
     FROM users u
     JOIN athlete_profile a ON a.user_id = u.id
     WHERE u.status = 'attivo'
       AND a.data_nascita IS NOT NULL
       AND substr(a.data_nascita, 6, 5) IN (${giorni.map(() => "?").join(",")})
       AND NOT EXISTS (SELECT 1 FROM compleanni_feed c WHERE c.user_id = u.id AND c.anno = ?)`
  )
    .bind(...giorni, anno)
    .all<{ userId: number; nome: string; nickname: string | null }>();
  if (!festeggiati.length) return;

  for (const f of festeggiati) {
    const { results: storico } = await env.DB.prepare(`SELECT frase FROM compleanni_feed WHERE user_id = ?`)
      .bind(f.userId)
      .all<{ frase: number }>();
    const frase = scegliFrase(storico.map((r) => r.frase));

    // INSERT OR IGNORE: se due giri del cron si sovrappongono, uno solo pubblica.
    const inserito = await env.DB.prepare(
      `INSERT OR IGNORE INTO compleanni_feed (user_id, anno, frase) VALUES (?, ?, ?)`
    )
      .bind(f.userId, anno, frase)
      .run();
    if ((inserito.meta.changes ?? 0) === 0) continue;

    const nome = (f.nickname?.trim() || f.nome?.trim() || "").trim() || "un membro della squadra";
    await env.DB.prepare(`INSERT INTO post_feed (user_id, tipo, testo) VALUES (?, 'compleanno', ?)`)
      .bind(f.userId, FRASI_COMPLEANNO[frase].replaceAll("{nome}", nome))
      .run();

    await inviaPushCompleanno(env, f.userId, nome);
  }
}

async function inviaPushCompleanno(env: Env, festeggiatoId: number, nome: string): Promise<void> {
  const { results: iscrizioni } = await env.DB.prepare(
    `SELECT ps.id, ps.user_id AS userId, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.status = 'attivo'`
  ).all<{ id: number; userId: number; endpoint: string; p256dh: string; auth: string }>();

  await Promise.all(
    iscrizioni.map(async (s) => {
      const payload =
        s.userId === festeggiatoId
          ? { title: `Tanti auguri ${nome}! 🎂`, body: "Tutta la 100FT ti augura buon compleanno 🎉", url: "/#/feed" }
          : { title: `Oggi è il compleanno di ${nome} 🎂`, body: "Passa nel Feed a fare gli auguri 🎉", url: "/#/feed" };
      try {
        const res = await sendWebPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
          payload,
          43200 // 12 ore: vale per tutta la giornata
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
