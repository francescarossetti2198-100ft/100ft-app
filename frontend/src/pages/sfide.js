import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

// TODO: classifiche multiple (Month/Season/Improvement/All Time), personal best,
// milestones (brief, sezione 10). Lista sfide + partecipazione già collegate alle API.
export function renderSfide(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Sfide</h1>
    <div id="sfide-list"><p class="mono" style="color:var(--mute)">Carico...</p></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadSfide(el);
}

async function loadSfide(el) {
  const list = el.querySelector("#sfide-list");
  try {
    const { sfide } = await api.get("/sfide");

    if (!sfide.length) {
      list.innerHTML = `<p class="mono" style="color:var(--mute)">Nessuna sfida al momento.</p>`;
      return;
    }

    const oggi = new Date().toISOString().slice(0, 10);
    list.innerHTML = sfide
      .map((s) => {
        const scaduta = s.data_fine < oggi;
        const stato = s.partecipato ? "Partecipato ✓" : scaduta ? "Sfida terminata" : "Partecipa";
        return `
          <div class="card" style="margin-bottom:12px" data-id="${s.id}">
            <p style="font-weight:600">${s.titolo}</p>
            ${s.descrizione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">${s.descrizione}</p>` : ""}
            <p class="mono" style="color:var(--accent); font-size:13px; margin-top:8px">+${s.punti} XP · ${s.numeroPartecipanti} partecipanti</p>
            <button class="btn partecipa-btn" style="width:100%; margin-top:10px" ${s.partecipato || scaduta ? "disabled" : ""}>
              ${stato}
            </button>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll(".partecipa-btn:not(:disabled)").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("[data-id]").dataset.id;
        e.target.disabled = true;
        try {
          await api.post(`/sfide/${id}/partecipa`, {});
          loadSfide(el);
        } catch (err) {
          e.target.disabled = false;
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
