import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

const TIPO_INFO = {
  level_up: { icona: "🎉", azione: "ha raggiunto un nuovo livello" },
  new_pb: { icona: "💪", azione: "ha fatto un nuovo Personal Best" },
  consistency: { icona: "🔥", azione: "ha raggiunto un traguardo di costanza" },
  athlete_of_week: { icona: "⭐", azione: "è Atleta della Settimana" },
  daily_drop: { icona: "💧", azione: "ha risposto al Daily Drop" },
  sfida: { icona: "🏆", azione: "ha completato una sfida" },
  annuncio_coach: { icona: "📣", azione: "" },
};

const EMOJI = ["👍", "🔥", "💪", "🎉"];

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
  el.innerHTML = `
    <h1>Feed</h1>
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
            ${p.contenutoUrl ? `<img src="${p.contenutoUrl}" alt="" style="width:100%; border-radius:10px; margin-top:10px; display:block" />` : ""}
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
