import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

// TODO: anelli settimanali, carta livello, nota del coach, richieste pre-allenamento
// (brief, sezione 7). Presenza di oggi + "in sala oggi" già collegate alle API.
export function renderHome(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Home</h1>
    <div class="card" id="presenza-card">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div class="card" id="progresso-card" style="margin-top:12px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadPresenza(el);
  loadProgresso(el);
}

// "Your Progress": card livello attuale + barra di progresso cumulativo (brief, sezione 7).
async function loadProgresso(el) {
  const card = el.querySelector("#progresso-card");
  try {
    const { livello } = await api.get("/profilo/me");
    if (!livello) {
      card.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun livello ancora.</p>`;
      return;
    }
    const { attuale, prossimo, settimaneCompletate } = livello;
    const progresso = prossimo
      ? Math.round(((settimaneCompletate - (attuale.settimaneMin - 1)) / (prossimo.settimaneMin - attuale.settimaneMin)) * 100)
      : 100;

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:13px">Il tuo livello</p>
      <p style="font-weight:600; color:${attuale.colore}; margin-top:4px">Livello ${attuale.numero} — ${attuale.nome}</p>
      <div style="background:var(--surface-2); border-radius:6px; height:6px; margin-top:10px; overflow:hidden">
        <div style="background:${attuale.colore}; width:${progresso}%; height:100%"></div>
      </div>
    `;
  } catch {
    card.remove();
  }
}

async function loadPresenza(el) {
  const card = el.querySelector("#presenza-card");
  try {
    const { sessione, confermata, inSala } = await api.get("/presenze/oggi");

    if (!sessione) {
      card.innerHTML = `<p class="mono" style="color:var(--mute)">Oggi non c'è sessione. Riposo.</p>`;
      return;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute)">Oggi ${sessione.ora_inizio}–${sessione.ora_fine}</p>
      <button class="btn" id="conferma-btn" style="width:100%; margin-top:12px" ${confermata ? "disabled" : ""}>
        ${confermata ? "Presenza confermata ✓" : "Confermo che vengo"}
      </button>
      <div style="margin-top:16px">
        <p class="mono" style="color:var(--mute); font-size:13px">In sala oggi (${inSala.length})</p>
        <p>${inSala.length ? inSala.map((a) => a.nickname || a.nome).join(", ") : "Nessuno ancora"}</p>
      </div>
    `;

    if (!confermata) {
      card.querySelector("#conferma-btn").addEventListener("click", async (e) => {
        e.target.disabled = true;
        try {
          await api.post("/presenze/conferma");
          loadPresenza(el);
        } catch (err) {
          e.target.disabled = false;
        }
      });
    }
  } catch (err) {
    card.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
