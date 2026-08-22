import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

const TIPO_LABEL = {
  presenza: "Sfida di gruppo",
  foto: "Sfida foto",
  valore_manuale: "Sfida personale",
};

// TODO: classifiche Season/Improvement/All Time (brief, sezione 10). Per ora solo Month.
export function renderSfide(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Sfide</h1>
    <div id="daily-drop-card" class="card" style="margin-bottom:16px"></div>
    <div id="classifica"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    <div id="sfide-list" style="margin-top:16px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadDailyDrop(el);
  loadClassifica(el);
  loadSfide(el);
}

async function loadDailyDrop(el) {
  const card = el.querySelector("#daily-drop-card");
  try {
    const { giornoValido, attivo, risposta, numeroRisposte } = await api.get("/daily-drop/oggi");

    // Solo nei giorni di allenamento (lun/mer/ven) — negli altri giorni la card non c'è.
    if (!giornoValido) {
      card.remove();
      return;
    }

    if (risposta) {
      card.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:12px">💧 DAILY DROP</p>
        <p style="margin-top:6px">Hai già risposto oggi ✓</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${numeroRisposte} atleti hanno già risposto</p>
      `;
      return;
    }

    // Non riveliamo mai l'orario esatto prima che scatti — si perderebbe l'effetto sorpresa.
    if (!attivo) {
      card.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:12px">💧 DAILY DROP</p>
        <p class="mono" style="color:var(--mute); margin-top:6px">Non ancora arrivato oggi — tieni d'occhio l'app.</p>
      `;
      return;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:12px">💧 DAILY DROP</p>
      <p style="margin-top:6px">Una foto al volo, ovunque tu sia in questo momento.</p>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${numeroRisposte} atleti hanno già risposto</p>
      <input id="dd-foto" type="file" accept="image/*" capture="environment"
             style="margin-top:10px; width:100%; color:var(--text)" />
      <p class="error-text" id="dd-error" hidden style="margin-top:6px"></p>
      <button class="btn" id="dd-submit" style="width:100%; margin-top:10px">Rispondi</button>
    `;

    card.querySelector("#dd-submit").addEventListener("click", async (e) => {
      const errorEl = card.querySelector("#dd-error");
      const input = card.querySelector("#dd-foto");
      errorEl.hidden = true;

      if (!input.files[0]) {
        errorEl.textContent = "Scegli o scatta una foto";
        errorEl.hidden = false;
        return;
      }

      e.target.disabled = true;
      const formData = new FormData();
      formData.append("foto", input.files[0]);
      try {
        await api.postForm("/daily-drop", formData);
        loadDailyDrop(el);
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
        e.target.disabled = false;
      }
    });
  } catch {
    card.remove();
  }
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
        const azione = s.partecipato
          ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:10px">Partecipato ✓</p>`
          : scaduta
            ? `<button class="btn" style="width:100%; margin-top:10px" disabled>Sfida terminata</button>`
            : s.tipo === "foto"
              ? `
                <input class="foto-input" type="file" accept="image/*" capture="environment"
                       style="margin-top:10px; width:100%; color:var(--text)" />
                <p class="error-text foto-error" hidden style="margin-top:6px"></p>
                <button class="btn partecipa-btn" style="width:100%; margin-top:10px">Carica foto e partecipa</button>
              `
              : `<button class="btn partecipa-btn" style="width:100%; margin-top:10px">Partecipa</button>`;

        return `
          <div class="card" style="margin-bottom:12px" data-id="${s.id}" data-tipo="${s.tipo}">
            <p class="mono" style="color:var(--mute); font-size:11px">${TIPO_LABEL[s.tipo] ?? s.tipo}</p>
            <p style="font-weight:600; margin-top:2px">${s.titolo}</p>
            ${s.descrizione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">${s.descrizione}</p>` : ""}
            <p class="mono" style="color:var(--accent); font-size:13px; margin-top:8px">+${s.punti} PT · ${s.numeroPartecipanti} partecipanti</p>
            ${azione}
          </div>
        `;
      })
      .join("");

    list.querySelectorAll(".partecipa-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const cardEl = e.target.closest("[data-id]");
        const id = cardEl.dataset.id;
        const errorEl = cardEl.querySelector(".foto-error");

        const formData = new FormData();
        if (cardEl.dataset.tipo === "foto") {
          const input = cardEl.querySelector(".foto-input");
          if (!input.files[0]) {
            errorEl.textContent = "Scegli o scatta una foto per convalidare la sfida";
            errorEl.hidden = false;
            return;
          }
          formData.append("foto", input.files[0]);
        }

        e.target.disabled = true;
        try {
          await api.postForm(`/sfide/${id}/partecipa`, formData);
          loadSfide(el);
          loadClassifica(el);
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
            errorEl.hidden = false;
          }
          e.target.disabled = false;
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
