import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

// Solo http/https: evita che un link_url malformato (es. "javascript:...") diventi un href eseguibile.
function linkSicuro(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

const MESI = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

export function renderProgramma(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Programma</h1>
    <div id="mesi-tabs" style="display:flex; gap:8px; overflow-x:auto; padding:12px 0"></div>
    <p class="mono" style="color:var(--mute); font-size:12px">
      I mesi futuri si sbloccano quando arrivano — niente spoiler sul programma 😉
    </p>
    <div id="mese-content" style="margin-top:16px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadMesi(el);
}

async function loadMesi(el) {
  const tabs = el.querySelector("#mesi-tabs");
  const content = el.querySelector("#mese-content");

  try {
    const { mesi } = await api.get("/programma");

    if (!mesi.length) {
      tabs.remove();
      content.innerHTML = `<p class="mono" style="color:var(--mute)">Nessun programma pubblicato ancora.</p>`;
      return;
    }

    // Default: l'ultimo mese sbloccato (il più recente disponibile).
    const sbloccati = mesi.filter((m) => m.sbloccato);
    let selezionato = (sbloccati.at(-1) ?? mesi[0]).id;

    tabs.innerHTML = mesi
      .map(
        (m) => `
          <button type="button" class="mese-tab" data-id="${m.id}"
            style="flex:0 0 auto; min-width:56px; padding:10px 6px; border-radius:8px; border:1px solid var(--border);
                   background:${m.id === selezionato ? "var(--surface-2)" : "transparent"}; color:var(--text)">
            <div class="mono" style="font-size:12px">${MESI[m.mese - 1]}</div>
            <div style="margin-top:4px">${m.sbloccato ? (m.id === selezionato ? "●" : "") : "🔒"}</div>
          </button>
        `
      )
      .join("");

    const selezionaTab = (id) => {
      selezionato = id;
      tabs.querySelectorAll(".mese-tab").forEach((btn) => {
        const attivo = Number(btn.dataset.id) === id;
        btn.style.background = attivo ? "var(--surface-2)" : "transparent";
        const dot = btn.querySelector("div:last-child");
        const mese = mesi.find((m) => m.id === Number(btn.dataset.id));
        dot.textContent = mese.sbloccato ? (attivo ? "●" : "") : "🔒";
      });
    };

    tabs.querySelectorAll(".mese-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const mese = mesi.find((m) => m.id === id);
        if (!mese.sbloccato) return;
        selezionaTab(id);
        loadDettaglio(content, id);
      });
    });

    loadDettaglio(content, selezionato);
  } catch (err) {
    tabs.remove();
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}

async function loadDettaglio(content, id) {
  content.innerHTML = `<p class="mono" style="color:var(--mute)">Carico...</p>`;
  try {
    const m = await api.get(`/programma/${id}`);

    content.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--accent); font-size:12px">${MESI[m.mese - 1].toUpperCase()} · ${m.anno}</p>
        <h2 style="margin-top:6px">${m.focusTema ?? "Focus del mese"}</h2>
        ${m.descrizione ? `<p style="margin-top:10px">${m.descrizione}</p>` : ""}

        ${
          m.lineeGuidaNutrizionali
            ? `
              <p class="mono" style="color:var(--mute); font-size:12px; margin-top:20px; border-top:1px solid var(--border); padding-top:14px">
                LINEE GUIDA NUTRIZIONALI GENERALI
              </p>
              <p style="margin-top:8px; font-size:14px">${m.lineeGuidaNutrizionali}</p>
            `
            : ""
        }

        ${
          m.merende?.length
            ? `
              <p class="mono" style="color:var(--mute); font-size:12px; margin-top:20px">MERENDE FIT DEL MESE</p>
              <div style="display:flex; gap:10px; margin-top:8px; flex-wrap:wrap">
                ${m.merende
                  .map((mf) => {
                    const link = mf.linkUrl ? linkSicuro(mf.linkUrl) : null;
                    return `
                      <div class="card" style="flex:1 1 140px; background:var(--surface-2)">
                        <p style="font-weight:600; font-size:14px">${mf.titolo}</p>
                        ${mf.descrizione ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${mf.descrizione}</p>` : ""}
                        ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="mono" style="color:var(--accent); font-size:12px; display:inline-block; margin-top:6px">▶ Vedi la ricetta</a>` : ""}
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
            : ""
        }

        <p class="mono" style="color:var(--mute); font-size:11px; margin-top:20px; font-style:italic">
          Indicazioni generali del coach, non una dieta personalizzata. Per esigenze specifiche, consulta un nutrizionista.
        </p>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
