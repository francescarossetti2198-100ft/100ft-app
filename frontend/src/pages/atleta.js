// Scheda pubblica di un atleta — quello che un compagno vede toccando la sua foto (nel
// Feed, in classifica, ecc.): foto, nickname, nome/cognome, livello. Sola lettura, niente
// dati privati. Raggiunta con /atleta?id=<userId> (vedi frontend/src/router.js
// `currentQuery`, stesso pattern già usato da reset-password.js e coach/mese.js).
import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";
import { currentQuery, navigate } from "../router.js";
import { fotoProfiloHtml, formatDataNascita } from "./profilo.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

export function renderAtletaPubblico(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <button type="button" class="link-btn" id="atleta-indietro" style="margin-bottom:16px">‹ Indietro</button>
    <div id="atleta-content"><p class="mono" style="color:var(--mute)">Carico...</p></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  el.querySelector("#atleta-indietro").addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else navigate("/feed");
  });

  caricaAtleta(el);
}

async function caricaAtleta(el) {
  const content = el.querySelector("#atleta-content");
  const id = currentQuery().get("id");
  if (!id) {
    content.innerHTML = `<p class="error-text">Atleta non specificato</p>`;
    return;
  }
  try {
    const p = await api.get(`/atleti/${id}/pubblico`);
    const nomeCompleto = `${p.nome ?? ""} ${p.cognome ?? ""}`.trim();
    const iniziale = (p.nickname || p.nome || "Atleta")[0]?.toUpperCase() ?? "?";
    const livelloLinea = p.livello
      ? `<p class="mono" style="color:${p.livello.attuale.colore}; font-size:13px; margin-top:6px; text-align:center">Livello ${p.livello.attuale.numero} — ${p.livello.attuale.nome}</p>`
      : `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:8px; text-align:center">Nessun livello ancora.</p>`;
    const iscrizione = formatDataNascita(p.dataIscrizione);
    const iscrizioneLinea = iscrizione
      ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px; text-align:center">Iscritto dal ${iscrizione}</p>`
      : "";

    content.innerHTML = `
      <div class="card" style="padding:28px 16px">
        ${fotoProfiloHtml(p.fotoUrl, iniziale, false, p.fotoPersonalizzazione, 96)}
        <p style="font-weight:700; font-size:20px; margin-top:14px; text-align:center">${esc(p.nickname || nomeCompleto || "Atleta")}</p>
        ${
          p.nickname && nomeCompleto
            ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:2px; text-align:center">${esc(nomeCompleto)}</p>`
            : ""
        }
        ${livelloLinea}
        ${iscrizioneLinea}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Atleta non trovato"}</p>`;
  }
}
