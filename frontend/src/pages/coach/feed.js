import { renderPaginaCoach } from "../../components/coach-shell.js";
import { attivaSezioniFeed } from "../feed.js";

export function renderCoachFeed(appEl) {
  renderPaginaCoach(appEl, { titolo: "Feed" }, (el) => {
    // Schede "Tutti" / "🗓️ Avvento" come nel Feed degli atleti (compaiono solo col calendario).
    el.innerHTML = `
      <div id="feed-sezioni" hidden></div>
      <button type="button" id="feed-nuove" hidden class="mono"
        style="width:100%; margin-top:10px; padding:9px; border-radius:9px; border:none; cursor:pointer;
               background:var(--accent); color:#fff; font-size:13px; font-weight:700">🔄 Nuove foto: tocca per vederle</button>
      <div id="feed-list" style="margin-top:12px"><p class="mono" style="color:var(--mute)">Carico...</p></div>`;
    const carica = attivaSezioniFeed({
      tabsEl: el.querySelector("#feed-sezioni"),
      avvisoEl: el.querySelector("#feed-nuove"),
      list: el.querySelector("#feed-list"),
    });
    carica();
  });
}
