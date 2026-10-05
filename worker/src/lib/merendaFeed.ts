import type { Env } from "../types";

// Intro sempre diverso per il post della merenda del giorno — ne pesca uno in base alla data.
const INTRO = [
  "Non sai cosa mangiare oggi per merenda? Ci pensiamo noi 👇",
  "Merenda fit di oggi: se sei a corto di idee, eccone una 🍎",
  "Spuntino sotto controllo — la merenda di oggi è servita 💪",
  "«Oggi cosa mangio a merenda?» Domanda risolta 👇",
  "Merenda del giorno pronta: buona, veloce, sensata 😉",
  "Un'idea per la merenda di oggi, così arrivi carico all'allenamento ⚡",
  "La merenda di oggi te la suggeriamo noi 🍏",
  "Fame di pomeriggio? La proposta fit per oggi è qui 👇",
  "Merenda di giornata: poca fatica, tanta sostanza 🥜",
  "Oggi si fa merenda così — parola della coach 🍎",
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
// mattina. Messaggio d'apertura sempre diverso + titolo, descrizione e la grafica se c'è.
// Una sola volta al giorno (merenda_feed_notifiche).
export async function pubblicaMerendaDelGiornoSeAttivo(env: Env): Promise<void> {
  const { data, oraMinuti } = oraRoma();
  if (oraMinuti !== "08:00") return;

  const merenda = await env.DB.prepare(
    `SELECT titolo, descrizione, foto_url AS fotoUrl, link_url AS linkUrl
     FROM merende_fit
     WHERE data = ? AND TRIM(titolo) <> ''
     ORDER BY ordine
     LIMIT 1`
  )
    .bind(data)
    .first<{ titolo: string; descrizione: string | null; fotoUrl: string | null; linkUrl: string | null }>();
  if (!merenda) return; // niente merenda pronta per oggi

  const inserito = await env.DB.prepare(
    `INSERT OR IGNORE INTO merenda_feed_notifiche (data) VALUES (?)`
  )
    .bind(data)
    .run();
  if ((inserito.meta.changes ?? 0) === 0) return; // già pubblicata oggi

  const idx = [...data].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % INTRO.length;
  const righe = [INTRO[idx], "", `🍎 ${merenda.titolo}`];
  if (merenda.descrizione?.trim()) righe.push(merenda.descrizione.trim());
  if (merenda.linkUrl?.trim()) righe.push("", `Ricetta 👉 ${merenda.linkUrl.trim()}`);

  await env.DB.prepare(
    `INSERT INTO post_feed (user_id, tipo, testo, contenuto_url) VALUES (NULL, 'merenda', ?, ?)`
  )
    .bind(righe.join("\n"), merenda.fotoUrl ?? null)
    .run();
}
