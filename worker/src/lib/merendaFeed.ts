import type { Env } from "../types";

// Intro sempre diverso per il post delle merende della settimana — ne pesca uno in base alla data.
const INTRO = [
  "Nuova settimana, nuove merende! Ecco le idee fino a domenica 👇",
  "Le merende fit della settimana sono servite 🍎",
  "Non sai cosa mangiare a merenda questa settimana? Ci pensiamo noi 👇",
  "Lunedì = menù merende della settimana. Salvatelo! 💪",
  "Sette giorni, sette merende: buone, veloci, sensate 😉",
  "Le idee merenda della settimana, così arrivi carico agli allenamenti ⚡",
  "Questa settimana si fa merenda così — parola della coach 🍏",
  "Fame di pomeriggio? Le proposte fit della settimana sono qui 👇",
  "Merende della settimana: poca fatica, tanta sostanza 🥜",
  "Ecco il programma merende fino a domenica 🍎",
];

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
  return {
    data: `${get("year")}-${get("month")}-${get("day")}`,
    oraMinuti: `${get("hour")}:${get("minute")}`,
  };
}

// Alle 08:00 (ora di Roma): la merenda fit datata oggi diventa visibile nella sezione
// "Merende fit" del Programma dalle 07:00, quindi il post nel Feed esce poco dopo, la
// mattina. Di norma la coach ne mette una a settimana, datata il lunedì (una grafica con
// le merende Lun–Dom). Messaggio d'apertura sempre diverso + titolo, descrizione e la
// grafica se c'è (basta anche solo la grafica). Una sola volta al giorno (merenda_feed_notifiche).
export async function pubblicaMerendaDelGiornoSeAttivo(env: Env): Promise<void> {
  const { data, oraMinuti } = oraRoma();
  if (oraMinuti !== "08:00") return;

  const merenda = await env.DB.prepare(
    `SELECT titolo, descrizione, foto_url AS fotoUrl, link_url AS linkUrl
     FROM merende_fit
     WHERE data = ? AND (TRIM(COALESCE(titolo, '')) <> '' OR foto_url IS NOT NULL)
     ORDER BY ordine
     LIMIT 1`
  )
    .bind(data)
    .first<{ titolo: string | null; descrizione: string | null; fotoUrl: string | null; linkUrl: string | null }>();
  if (!merenda) return; // niente merenda pronta per oggi

  const inserito = await env.DB.prepare(
    `INSERT OR IGNORE INTO merenda_feed_notifiche (data) VALUES (?)`
  )
    .bind(data)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già pubblicata oggi

  const idx = [...data].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % INTRO.length;
  const righe = [INTRO[idx]];
  if (merenda.titolo?.trim()) righe.push("", `🍎 ${merenda.titolo.trim()}`);
  if (merenda.descrizione?.trim()) righe.push(merenda.descrizione.trim());
  if (merenda.linkUrl?.trim()) righe.push("", `Ricetta 👉 ${merenda.linkUrl.trim()}`);

  await env.DB.prepare(
    `INSERT INTO post_feed (user_id, tipo, testo, contenuto_url) VALUES (NULL, 'merenda', ?, ?)`
  )
    .bind(righe.join("\n"), merenda.fotoUrl ?? null)
    .run();
}
