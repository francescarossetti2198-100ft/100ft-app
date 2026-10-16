import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";
import { navigate } from "../router.js";
import { fotoProfiloHtml } from "./profilo.js";

// Notifiche dell'atleta, stile Instagram: chi ha commentato o reagito ai tuoi post, i punti
// (sempre col perché), traguardi, compleanni, sorpassi in classifica (a cui si risponde con
// un'emoji), la coach, il promemoria della domenica e il riepilogo del lunedì.
// I dati arrivano già pronti da GET /api/notifiche (worker/src/lib/notifiche.ts).

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function istante(data) {
  return new Date(`${String(data).replace(" ", "T")}Z`);
}

function tempoFa(data) {
  const minuti = Math.floor((Date.now() - istante(data).getTime()) / 60000);
  if (minuti < 1) return "adesso";
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} h`;
  const giorni = Math.floor(ore / 24);
  return giorni < 7 ? `${giorni} g` : `${Math.floor(giorni / 7)} sett`;
}

// Come Instagram: prima le nuove, poi le già viste per periodo.
function gruppoDi(n) {
  if (n.nuova) return "Nuove";
  const giorni = (Date.now() - istante(n.data).getTime()) / 86400000;
  if (giorni < 7) return "Questa settimana";
  if (giorni < 30) return "Questo mese";
  return "Prima";
}

function nomiHtml(n) {
  const a = n.attori ?? [];
  if (!a.length) return "";
  const nome = (x) => `<strong>${esc(x.nome)}</strong>`;
  const tot = n.totaleAttori ?? a.length;
  if (tot === 1) return nome(a[0]);
  if (tot === 2 && a[1]) return `${nome(a[0])} e ${nome(a[1])}`;
  return `${nome(a[0])}, ${nome(a[1])} e altri ${tot - 2}`;
}

function avatarHtml(n) {
  const a = n.attori?.[0];
  if (a) {
    const foto = fotoProfiloHtml(a.fotoUrl, esc((a.nome[0] || "?").toUpperCase()), false, a.fotoPersonalizzazione, 44);
    // Due persone: la seconda foto sovrapposta in basso a destra, come su Instagram.
    const b = n.attori[1];
    if (!b) return foto;
    const foto2 = fotoProfiloHtml(b.fotoUrl, esc((b.nome[0] || "?").toUpperCase()), false, b.fotoPersonalizzazione, 30);
    return `<span style="position:relative; display:block; width:44px; height:44px">
      <span style="position:absolute; left:0; top:0; transform:scale(.8); transform-origin:top left">${foto}</span>
      <span style="position:absolute; right:-4px; bottom:-4px; border-radius:50%; box-shadow:0 0 0 2px var(--bg)">${foto2}</span>
    </span>`;
  }
  if (n.tipo === "punti") {
    return `<span class="nt-icona" style="background:color-mix(in srgb, var(--livello-1) 18%, var(--surface-2)); color:var(--livello-1); font-weight:700; font-size:14px">+${n.punti}</span>`;
  }
  return `<span class="nt-icona">${n.icona ?? "🔔"}</span>`;
}

function rigaHtml(n) {
  const nomi = nomiHtml(n);
  const anteprima = n.anteprima ? ` <span style="color:var(--mute)">«${esc(n.anteprima)}»</span>` : "";
  const puntiPill = n.tipo === "riepilogo" && n.punti ? `<span class="mono nt-pill">+${n.punti}</span>` : "";

  let extra = "";
  if (n.tipo === "sorpasso") {
    extra = n.reazione
      ? `<p class="mono" style="margin:6px 0 0; font-size:12px; color:var(--mute)">Hai risposto ${esc(n.reazione)}</p>`
      : `<div class="nt-emoji-riga" style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap">
          ${n.emoji
            .map(
              (e) =>
                `<button type="button" class="nt-emoji-btn" data-sorpasso="${n.sorpassoId}" data-emoji="${e}" aria-label="Rispondi con ${e}">${e}</button>`
            )
            .join("")}
        </div>`;
  }
  if (n.tipo === "riepilogo" && n.dettagli?.length) {
    extra = `<div class="nt-dettagli" hidden style="margin-top:8px; border-top:1px solid var(--border)">
      ${n.dettagli
        .map(
          (d) => `<div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px solid var(--border); font-size:13px">
            <span>${esc(d.testo)}</span>
            <span class="mono" style="color:var(--livello-1); flex:0 0 auto">+${d.punti}</span>
          </div>`
        )
        .join("")}
    </div>`;
  }

  const cliccabile = n.link || n.tipo === "riepilogo";
  return `
    <div class="nt-riga${n.nuova ? " nt-nuova" : ""}${cliccabile ? " nt-link" : ""}" data-id="${esc(n.id)}"
         ${n.link ? `data-link="${esc(n.link)}"` : ""} ${cliccabile ? 'role="button" tabindex="0"' : ""}>
      <span style="flex:0 0 auto; line-height:0">${avatarHtml(n)}</span>
      <div style="flex:1; min-width:0">
        <p style="margin:0; font-size:14px; line-height:1.4">
          ${nomi}${nomi ? " " : ""}${esc(n.testo)}${anteprima}
          <span class="mono" style="color:var(--mute); font-size:12px; white-space:nowrap"> · ${tempoFa(n.data)}</span>
        </p>
        ${extra}
      </div>
      ${puntiPill}
      ${n.nuova ? `<span class="nt-pallino" aria-label="nuova"></span>` : ""}
    </div>`;
}

export function renderNotifiche(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <style>
      .nt-riga { display:flex; align-items:flex-start; gap:12px; padding:10px 8px; margin:0 -8px; border-radius:12px }
      .nt-link { cursor:pointer }
      .nt-nuova { background:color-mix(in srgb, var(--accent) 9%, transparent) }
      .nt-icona { width:44px; height:44px; border-radius:50%; background:var(--surface-2); display:flex;
        align-items:center; justify-content:center; font-size:20px }
      .nt-pallino { flex:0 0 auto; width:8px; height:8px; border-radius:50%; background:var(--accent); margin-top:8px }
      .nt-pill { flex:0 0 auto; align-self:center; color:var(--livello-1); font-size:13px; font-weight:700 }
      .nt-emoji-btn { appearance:none; border:1px solid var(--border); background:var(--surface-2); border-radius:999px;
        padding:4px 10px; font-size:18px; line-height:1.2; cursor:pointer }
      .nt-gruppo { font-size:15px; font-weight:700; margin:18px 0 6px }
    </style>
    <h1>Notifiche</h1>
    <div id="nt-lista"><p class="mono" style="color:var(--mute)">Carico...</p></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  const lista = el.querySelector("#nt-lista");
  carica(lista);
}

async function carica(lista) {
  let notifiche;
  try {
    ({ notifiche } = await api.get("/notifiche"));
  } catch (err) {
    lista.innerHTML = `<p class="error-text">${esc(err instanceof ApiError ? err.message : "Impossibile caricare le notifiche")}</p>`;
    return;
  }

  if (!notifiche.length) {
    lista.innerHTML = `<p class="mono" style="color:var(--mute); margin-top:24px; text-align:center">
      Ancora nessuna notifica.<br/>Qui vedrai chi reagisce ai tuoi post, i tuoi punti e i tuoi traguardi.</p>`;
    return;
  }

  const gruppi = new Map();
  for (const n of notifiche) {
    const g = gruppoDi(n);
    gruppi.set(g, [...(gruppi.get(g) ?? []), n]);
  }
  lista.innerHTML = [...gruppi]
    .map(([titolo, righe]) => `<p class="nt-gruppo">${titolo}</p>${righe.map(rigaHtml).join("")}`)
    .join("");

  lista.querySelectorAll(".nt-link").forEach((riga) => {
    const apri = (e) => {
      if (e.target.closest(".nt-emoji-btn")) return;
      const dettagli = riga.querySelector(".nt-dettagli");
      if (dettagli) {
        dettagli.hidden = !dettagli.hidden;
        return;
      }
      if (riga.dataset.link) navigate(riga.dataset.link);
    };
    riga.addEventListener("click", apri);
    riga.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apri(e);
    });
  });

  lista.querySelectorAll(".nt-emoji-btn").forEach((b) => {
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const riga = b.closest(".nt-emoji-riga");
      riga.querySelectorAll("button").forEach((x) => (x.disabled = true));
      try {
        await api.post(`/notifiche/sorpasso/${b.dataset.sorpasso}/reazione`, { emoji: b.dataset.emoji });
        riga.outerHTML = `<p class="mono" style="margin:6px 0 0; font-size:12px; color:var(--mute)">Hai risposto ${esc(b.dataset.emoji)}</p>`;
      } catch (err) {
        riga.querySelectorAll("button").forEach((x) => (x.disabled = false));
        alert(err instanceof ApiError ? err.message : "Errore imprevisto");
      }
    });
  });
}
