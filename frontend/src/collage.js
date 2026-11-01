import { mediaUrl } from "./api.js";

// Collage di una sfida a tappe ("La mia giornata", nov 2026): le foto delle missioni in una
// griglia 3×2 numerata, sul modello della grafica di Francesca — fondo crema, testata
// 100FT con l'etichetta gialla del mese, titolo grande, sotto ogni foto numero + nome +
// emoji. Colori fissi (non seguono il tema): è una "grafica", come un poster.
// Usato nel post del Feed e nella card della sfida completata.

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// "Pausa pranzo 🍽️ — Una foto del tuo pranzo." → { nome: "Pausa pranzo", emoji: "🍽️" }
const EMOJI_FINALE = /\s*((?:\p{Extended_Pictographic}|️|‍)+)\s*$/u;
function nomeMissione(m) {
  const nome = m.split(" — ")[0].trim();
  const e = nome.match(EMOJI_FINALE);
  return e ? { nome: nome.slice(0, e.index).trim(), emoji: e[1] } : { nome, emoji: "" };
}

// Toglie l'emoji iniziale del titolo ("📸 La mia giornata" → "La mia giornata").
const titoloPulito = (t) => t.replace(/^(?:\p{Extended_Pictographic}|️|‍|\s)+/u, "");

// { titolo, dataInizio: "2026-11-01", missioni: [...], foto: [url per missione] }
export function collageHtml({ titolo, dataInizio, missioni, foto }) {
  const mese = MESI[Number(dataInizio.slice(5, 7)) - 1] ?? "";
  const giallo = "#ffd84d";
  const tessere = missioni
    .map((m, i) => {
      const { nome, emoji } = nomeMissione(m);
      return `
        <div style="background:#fff; border-radius:10px; overflow:hidden; border:1px solid #e7e0d2; display:flex; flex-direction:column">
          ${foto[i]
            ? `<img src="${mediaUrl(foto[i])}" alt="${esc(nome)}" loading="lazy" decoding="async"
                 style="width:100%; aspect-ratio:1; object-fit:cover; display:block" />`
            : `<div style="width:100%; aspect-ratio:1; background:#eee8dc"></div>`}
          <div style="position:relative; padding:12px 6px 7px; flex:1">
            <span style="position:absolute; top:-10px; left:6px; background:${giallo}; color:#111; font-weight:700;
                         font-size:11px; line-height:1; padding:4px 6px; border-radius:4px">${i + 1}.</span>
            ${emoji ? `<span style="position:absolute; top:-12px; right:6px; width:24px; height:24px; border-radius:50%;
                         background:#fff; display:flex; align-items:center; justify-content:center;
                         font-size:13px; line-height:1">${emoji}</span>` : ""}
            <span style="display:block; font-size:clamp(9px, 2.6vw, 12px); line-height:1.2; color:#111; hyphens:auto">${esc(nome)}</span>
          </div>
        </div>`;
    })
    .join("");

  return `
    <div class="collage-tappe" lang="it" style="background:#f6f1e7; color:#111; border-radius:14px; padding:14px 12px 12px;
         font-family:var(--font-mono); border:1px solid #e7e0d2">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
        <img src="/logo-nero.png" alt="100 Functional Training" style="height:30px; width:auto; display:block" />
        <span style="width:1px; height:26px; background:#111; margin:0 4px"></span>
        <span style="background:${giallo}; font-weight:700; font-size:11px; letter-spacing:0.5px; padding:4px 8px; text-transform:uppercase">Sfida di ${mese}</span>
      </div>
      <p style="font-family:var(--font-mono); font-weight:700; font-size:clamp(22px, 7vw, 34px); letter-spacing:-1px;
                line-height:1.05; margin:10px 0 12px">${esc(titoloPulito(titolo))}</p>
      <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px">${tessere}</div>
    </div>`;
}

// Bottone "Scarica il collage": i dati viaggiano nell'attributo, attachCollage li legge.
export function scaricaCollageHtml(dati) {
  return `
    <button type="button" class="btn collage-scarica" data-collage="${esc(JSON.stringify(dati))}"
      style="width:100%; margin-top:10px; background:var(--surface-2); color:var(--text)">⬇️ Scarica il collage</button>
    <p class="error-text collage-errore" hidden style="margin-top:6px"></p>`;
}

export function attachCollage(scope) {
  scope.querySelectorAll(".collage-scarica").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const errore = btn.nextElementSibling;
      const testo = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Preparo l'immagine...";
      errore.hidden = true;
      try {
        await condividiOScarica(await collagePng(JSON.parse(btn.dataset.collage)));
      } catch (err) {
        // L'utente che chiude il pannello di condivisione non è un errore.
        if (err?.name !== "AbortError") {
          errore.textContent = "Non riesco a preparare l'immagine, riprova";
          errore.hidden = false;
        }
      } finally {
        btn.disabled = false;
        btn.textContent = testo;
      }
    });
  });
}

// Sul telefono il pannello di condivisione (Salva immagine, Instagram, WhatsApp…): nella PWA
// su iPhone un link "download" non funziona. Dove non c'è, download classico.
async function condividiOScarica(blob) {
  const file = new File([blob], "la-mia-giornata-100ft.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function caricaImmagine(src) {
  // fetch + blob: le foto stanno su api.100-ft.com (CORS ok), così il canvas non è "sporco".
  const r = await fetch(src);
  if (!r.ok) throw new Error(`immagine ${r.status}`);
  return createImageBitmap(await r.blob());
}

function rettangoloTondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Stesso disegno del collage HTML, ridisegnato su canvas a 1080 px di larghezza.
async function collagePng({ titolo, dataInizio, missioni, foto }) {
  const W = 1080, P = 48, GAP = 20, COL = 3;
  const tile = (W - 2 * P - GAP * (COL - 1)) / COL;
  const etichetta = 96;
  const righe = Math.ceil(missioni.length / COL);
  const testaH = 84, titoloH = 110;
  const H = P + testaH + titoloH + righe * (tile + etichetta) + (righe - 1) * GAP + P;

  await Promise.all([
    document.fonts.load('700 80px "Space Mono"'),
    document.fonts.load('400 30px "Space Mono"'),
  ]).catch(() => {});
  const [logo, ...immagini] = await Promise.all([
    caricaImmagine("/logo-nero.png"),
    ...foto.map((u) => (u ? caricaImmagine(mediaUrl(u)) : null)),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const mono = (peso, px) => `${peso} ${px}px "Space Mono", ui-monospace, monospace`;

  ctx.fillStyle = "#f6f1e7";
  ctx.fillRect(0, 0, W, H);

  // Testata: logo | etichetta gialla del mese
  const logoH = 64, logoW = (logo.width / logo.height) * logoH;
  ctx.drawImage(logo, P, P + (testaH - logoH) / 2 - 10, logoW, logoH);
  const xLinea = P + logoW + 24;
  ctx.fillStyle = "#111";
  ctx.fillRect(xLinea, P + 6, 2, testaH - 32);
  const mese = MESI[Number(dataInizio.slice(5, 7)) - 1] ?? "";
  const tag = `SFIDA DI ${mese.toUpperCase()}`;
  ctx.font = mono(700, 26);
  const tagW = ctx.measureText(tag).width + 32;
  ctx.fillStyle = "#ffd84d";
  ctx.fillRect(xLinea + 26, P + 4, tagW, 48);
  ctx.fillStyle = "#111";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, xLinea + 42, P + 29);

  // Titolo
  ctx.font = mono(700, 82);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(titoloPulito(titolo), P - 4, P + testaH + 76);

  // Tessere
  missioni.forEach((m, i) => {
    const { nome, emoji } = nomeMissione(m);
    const x = P + (i % COL) * (tile + GAP);
    const y = P + testaH + titoloH + Math.floor(i / COL) * (tile + etichetta + GAP);
    ctx.save();
    rettangoloTondo(ctx, x, y, tile, tile + etichetta, 22);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.clip();
    const img = immagini[i];
    if (img) {
      const lato = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - lato) / 2, (img.height - lato) / 2, lato, lato, x, y, tile, tile);
    } else {
      ctx.fillStyle = "#eee8dc";
      ctx.fillRect(x, y, tile, tile);
    }
    ctx.restore();
    ctx.strokeStyle = "#e7e0d2";
    ctx.lineWidth = 2;
    rettangoloTondo(ctx, x, y, tile, tile + etichetta, 22);
    ctx.stroke();

    // numero giallo a cavallo tra foto ed etichetta
    ctx.font = mono(700, 26);
    const num = `${i + 1}.`;
    const numW = ctx.measureText(num).width + 20;
    ctx.fillStyle = "#ffd84d";
    rettangoloTondo(ctx, x + 14, y + tile - 22, numW, 42, 8);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.textBaseline = "middle";
    ctx.fillText(num, x + 24, y + tile - 1);

    // emoji nel cerchio bianco a destra
    if (emoji) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + tile - 34, y + tile, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `28px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(emoji, x + tile - 34, y + tile + 2);
      ctx.textAlign = "left";
    }

    // nome su massimo 2 righe
    ctx.font = mono(400, 24);
    ctx.fillStyle = "#111";
    ctx.textBaseline = "alphabetic";
    const righeNome = aCapo(ctx, nome, tile - 28).slice(0, 2);
    righeNome.forEach((r, k) => ctx.fillText(r, x + 14, y + tile + 50 + k * 30));
  });

  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("toBlob"))), "image/png"));
}

function aCapo(ctx, testo, larghezza) {
  const righe = [];
  let riga = "";
  for (const parola of testo.split(" ")) {
    const prova = riga ? `${riga} ${parola}` : parola;
    if (riga && ctx.measureText(prova).width > larghezza) {
      righe.push(riga);
      riga = parola;
    } else riga = prova;
  }
  if (riga) righe.push(riga);
  return righe;
}
