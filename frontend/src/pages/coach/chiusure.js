import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initChiusure, SEL_STYLE } from "../coach.js";

export function renderCoachChiusure(appEl) {
  renderPaginaCoach(appEl, { titolo: "Giorni di chiusura" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">
          Festività o palestra chiusa: quella settimana gli anelli diventano 2/2 invece di 3/3.
        </p>
        <div style="display:flex; gap:8px; margin-top:12px; align-items:flex-end; flex-wrap:wrap">
          <div class="field" style="flex:1; min-width:130px; margin:0">
            <label>Giorno</label>
            <input id="chiusura-data" type="date" style="${SEL_STYLE}" />
          </div>
          <div class="field" style="flex:2; min-width:130px; margin:0">
            <label>Motivo (facoltativo)</label>
            <input id="chiusura-motivo" type="text" placeholder="es. Ferragosto" style="${SEL_STYLE}" />
          </div>
          <button class="btn" id="chiusura-aggiungi" style="background:var(--surface-2); color:var(--text)">Aggiungi</button>
        </div>
        <p class="error-text" id="chiusura-error" hidden style="margin-top:6px"></p>
        <div id="chiusura-lista" style="margin-top:12px"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>
      </div>`;
    initChiusure(el);
  });
}
