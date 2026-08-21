import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

const TIPO_LABEL = {
  presenza: "Sfida di gruppo",
  foto: "Sfida foto",
  valore_manuale: "Sfida personale",
};

// TODO: classifiche Season/Improvement/All Time, personal best, milestones (brief, sezione 10).
// Per ora solo la classifica del mese.
export function renderSfide(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Sfide</h1>
    <div id="classifica"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    <div id="sfide-list" style="margin-top:16px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadClassifica(el);
  loadSfide(el);
}

async function loadClassifica(el) {
  const box = el.querySelector("#classifica");
  try {
    const { classifica } = await api.get("/sfide/classifica");
    const top = classifica.slice(0, 5);

    box.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--mute); font-size:13px">Classifica del mese</p>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px">
          ${top
            .map(
              (a, i) => `
                <div style="display:flex; justify-content:space-between">
                  <span>${i + 1}. ${a.nickname || a.nome}</span>
                  <strong>${a.punti} PT</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  } catch {
    box.remove();
  }
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
            <p class="mono" style="color:var(--mute); font-size:11px">${TIPO_LABEL[s.tipo] ?? s.tipo}</p>
            <p style="font-weight:600; margin-top:2px">${s.titolo}</p>
            ${s.descrizione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">${s.descrizione}</p>` : ""}
            <p class="mono" style="color:var(--accent); font-size:13px; margin-top:8px">+${s.punti} PT · ${s.numeroPartecipanti} partecipanti</p>
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
          loadClassifica(el);
        } catch (err) {
          e.target.disabled = false;
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
