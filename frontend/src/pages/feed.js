import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError, mediaUrl } from "../api.js";

const TIPO_INFO = {
  level_up: { icona: "🎉", azione: "ha raggiunto un nuovo livello" },
  new_pb: { icona: "💪", azione: "ha fatto un nuovo Personal Best" },
  consistency: { icona: "🔥", azione: "ha raggiunto un traguardo di costanza" },
  athlete_of_week: { icona: "⭐", azione: "è Atleta della Settimana" },
  daily_drop: { icona: "💧", azione: "ha risposto al Daily Drop" },
  sfida: { icona: "🏆", azione: "ha completato una sfida" },
  badge: { icona: "🏅", azione: "ha conquistato il badge di" },
  annuncio_coach: { icona: "📣", azione: "" },
};

const EMOJI = ["👍", "🔥", "💪", "🎉"];

// Playlist ufficiale di 100FT su Spotify — mini-banner stretto in fondo al Feed.
const SPOTIFY_PLAYLIST_URL = "https://open.spotify.com/playlist/3Qw3Mw1PuhB8H1BslDyWaw";

// Logo Spotify (SVG inline, path ufficiale monopath) — niente asset esterni, niente embed.
const SPOTIFY_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" style="width:26px;height:26px;flex:0 0 auto;display:block"><path fill="#1ED760" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.56-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`;

function bannerSpotifyHtml() {
  return `
    <a class="card" href="${SPOTIFY_PLAYLIST_URL}" target="_blank" rel="noopener"
       style="display:flex; align-items:center; gap:10px; text-decoration:none;
              margin:10px 0 0; padding:10px 14px">
      ${SPOTIFY_LOGO}
      <span class="mono" style="color:var(--mute); font-size:12px; line-height:1.4">
        La nostra <strong style="color:var(--text)">playlist di Spotify</strong> per allenarti con la carica ↗
      </span>
    </a>
  `;
}

function tempoFa(dataIso) {
  const diffMs = Date.now() - new Date(dataIso + "Z").getTime();
  const minuti = Math.floor(diffMs / 60000);
  if (minuti < 1) return "adesso";
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} h`;
  return `${Math.floor(ore / 24)} g`;
}

// TODO: filtri per tipo, commenti (brief, sezione 11 — solo reazioni previste, niente commenti).
export function renderFeed(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  // Testata fissa: "Feed" + banner Spotify restano in cima mentre la lista scorre sotto.
  // I margini negativi allargano lo sfondo fino ai bordi (la .screen ha padding 20/16).
  el.innerHTML = `
    <div style="position:sticky; top:0; z-index:5; background:var(--bg); margin:-20px -16px 0; padding:20px 16px 12px">
      <h1 style="margin:0; padding-right:48px">Feed</h1>
      ${bannerSpotifyHtml()}
    </div>
    <div id="feed-list" style="margin-top:12px"><p class="mono" style="color:var(--mute)">Carico...</p></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadFeed(el);
}

async function loadFeed(el) {
  const list = el.querySelector("#feed-list");
  try {
    const { posts } = await api.get("/feed");

    if (!posts.length) {
      list.innerHTML = `<p class="mono" style="color:var(--mute)">Ancora nessun post.</p>`;
      return;
    }

    list.innerHTML = posts
      .map((p) => {
        const info = TIPO_INFO[p.tipo] ?? { icona: "•", azione: "" };
        const autore = p.tipo === "annuncio_coach" ? "Coach" : p.nickname || p.nome || "Atleta";

        const reazioniHtml = EMOJI.map((e) => {
          const r = p.reazioni.find((x) => x.emoji === e);
          const attiva = r?.mia;
          return `
            <button type="button" class="reazione-btn" data-post="${p.id}" data-emoji="${e}"
              style="background:${attiva ? "var(--accent)" : "var(--surface-2)"}; border:none; border-radius:6px;
                     padding:4px 8px; font-size:13px; color:var(--text); cursor:pointer">
              ${e} ${r?.n ?? ""}
            </button>
          `;
        }).join("");

        return `
          <div class="card" style="margin-bottom:12px">
            <p style="font-size:14px">
              <strong>${autore}</strong>
              ${info.icona} <span class="mono" style="color:var(--mute); font-size:13px">${info.azione}</span>
              <span class="mono" style="color:var(--mute); font-size:12px; float:right">${tempoFa(p.data)}</span>
            </p>
            <p style="margin-top:8px">${p.testo}</p>
            ${p.contenutoUrl ? `<img src="${mediaUrl(p.contenutoUrl)}" alt="" style="width:100%; border-radius:10px; margin-top:10px; display:block" />` : ""}
            <div style="display:flex; gap:6px; margin-top:10px">${reazioniHtml}</div>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll(".reazione-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api.post(`/feed/${btn.dataset.post}/reazioni`, { emoji: btn.dataset.emoji });
          loadFeed(el);
        } catch {
          // silenzioso: la reazione è un'azione a basso rischio, non serve un messaggio d'errore dedicato
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
