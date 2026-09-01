import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initSuddivisioni, MESI, SEL_STYLE, oraCorrente } from "../coach.js";

export function renderCoachAbbonamenti(appEl) {
  const { mese, anno } = oraCorrente();
  renderPaginaCoach(appEl, { titolo: "Abbonamenti" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--mute); font-size:11px; margin-top:0">Suddivisioni & pagamenti · bozza — imposta le % mancanti quando hai deciso.</p>
        <div style="display:flex; gap:8px; margin-top:12px">
          <select id="sudd-mese" style="flex:2; ${SEL_STYLE}">
            ${MESI.map((m, i) => `<option value="${i + 1}" ${i + 1 === mese ? "selected" : ""}>${m}</option>`).join("")}
          </select>
          <input id="sudd-anno" type="number" value="${anno}" style="flex:1; ${SEL_STYLE}" />
        </div>
        <div id="sudd-body" style="margin-top:12px"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>
      </div>`;
    initSuddivisioni(el);
  });
}
