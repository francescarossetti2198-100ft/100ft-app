import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initDiario, MESI, SEL_STYLE, oraCorrente } from "../coach.js";

export function renderCoachDiario(appEl) {
  const { mese, anno } = oraCorrente();
  renderPaginaCoach(appEl, { titolo: "Diario allenamenti" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">
          Per ogni allenamento: il focus del giorno e la scheda (PDF/Word). Puoi pubblicare ogni voce nel Feed.
        </p>
        <div style="display:flex; gap:8px; margin-top:10px">
          <select id="diario-mese" style="flex:2; ${SEL_STYLE}">
            ${MESI.map((m, i) => `<option value="${i + 1}" ${i + 1 === mese ? "selected" : ""}>${m}</option>`).join("")}
          </select>
          <input id="diario-anno" type="number" value="${anno}" style="flex:1; ${SEL_STYLE}" />
        </div>
        <p class="mono" id="diario-focus-mese" style="color:var(--mute); font-size:12px; margin-top:8px; display:none"></p>
        <div id="diario-calendario" style="margin-top:12px"></div>
        <details class="blocco-mese" id="diario-dettaglio" style="margin-top:12px; border-top:0">
          <summary><span id="diario-summary">Diario del mese</span></summary>
          <div class="blocco-corpo">
            <div id="diario-rows" style="display:flex; flex-direction:column; gap:12px"></div>
          </div>
        </details>
      </div>`;
    initDiario(el);
  });
}
