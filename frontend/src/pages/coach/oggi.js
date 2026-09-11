import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initOggi } from "../coach.js";

export function renderCoachOggi(appEl) {
  renderPaginaCoach(appEl, { titolo: "Oggi" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--mute); font-size:12px">CHECK — PROSSIMO ALLENAMENTO</p>
        <div id="coach-oggi-body" style="margin-top:10px"></div>
      </div>`;
    initOggi(el);
  });
}
