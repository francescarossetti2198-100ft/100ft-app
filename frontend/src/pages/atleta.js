// Scheda pubblica di un atleta — quello che un compagno vede toccando la sua foto (nel
// Feed, in classifica, dalla ricerca): foto, nickname, nome/cognome, livello, i suoi badge,
// i suoi progressi (presenze, settimane complete, classifica — niente statistiche) e tutti
// i post che ha pubblicato nel Feed. Sola lettura, niente dati privati.
// Raggiunta con /atleta?id=<userId> (vedi frontend/src/router.js `currentQuery`).
import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";
import { currentQuery, navigate } from "../router.js";
import { fotoProfiloHtml, formatDataNascita } from "./profilo.js";
import { badgeMensiliHtml } from "../badge-mensili.js";
import { montaFeed } from "./feed.js";

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
    const etichetta = p.nickname || nomeCompleto || "Atleta";
    const livelloLinea = p.livello
      ? `<p class="mono" style="color:${p.livello.attuale.colore}; font-size:13px; margin-top:6px; text-align:center">Livello ${p.livello.attuale.numero} — ${p.livello.attuale.nome}</p>`
      : `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:8px; text-align:center">Nessun livello ancora.</p>`;
    const iscrizione = formatDataNascita(p.dataIscrizione);
    const iscrizioneLinea = iscrizione
      ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px; text-align:center">Iscritto dal ${iscrizione}</p>`
      : "";

    const classifica =
      p.classifica && p.classifica.totaleAtleti
        ? `${p.classifica.posizione}° / ${p.classifica.totaleAtleti}`
        : "—";

    content.innerHTML = `
      <div class="card" style="padding:28px 16px">
        ${fotoProfiloHtml(p.fotoUrl, iniziale, false, p.fotoPersonalizzazione, 96)}
        <p style="font-weight:700; font-size:20px; margin-top:14px; text-align:center">${esc(etichetta)}</p>
        ${
          p.nickname && nomeCompleto
            ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:2px; text-align:center">${esc(nomeCompleto)}</p>`
            : ""
        }
        ${livelloLinea}
        ${iscrizioneLinea}
      </div>

      <div class="card" style="margin-top:12px">
        <p class="sezione-label">I badge di ${esc(etichetta)}</p>
        <div style="margin-top:12px">${badgeMensiliHtml(p.badgeMensili)}</div>
      </div>

      <div class="card" style="margin-top:12px">
        <p class="sezione-label">I progressi di ${esc(etichetta)}</p>
        <div style="display:flex; justify-content:space-around; text-align:center; margin-top:14px">
          <div>
            <p style="font-weight:600; font-size:18px">${p.presenzeTotali ?? 0}</p>
            <p class="mono" style="color:var(--mute); font-size:12px">Presenze tot.</p>
          </div>
          <div>
            <p style="font-weight:600; font-size:18px">${p.settimaneComplete ?? 0}</p>
            <p class="mono" style="color:var(--mute); font-size:12px">Settimane complete</p>
          </div>
          <div>
            <p style="font-weight:600; font-size:18px">${classifica}</p>
            <p class="mono" style="color:var(--mute); font-size:12px">Classifica</p>
          </div>
        </div>
      </div>

      <p class="sezione-label" style="margin:20px 0 0 4px">Nel Feed</p>
      <div id="atleta-feed" style="margin-top:10px"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    `;

    montaFeed(content.querySelector("#atleta-feed"), { userId: p.userId ?? Number(id) });
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Atleta non trovato"}</p>`;
  }
}
