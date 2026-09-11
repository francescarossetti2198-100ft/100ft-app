import { renderPaginaCoach } from "../../components/coach-shell.js";
import { montaFeed } from "../feed.js";

export function renderCoachFeed(appEl) {
  renderPaginaCoach(appEl, { titolo: "Feed" }, (el) => {
    el.innerHTML = `<div id="feed-list"><p class="mono" style="color:var(--mute)">Carico...</p></div>`;
    montaFeed(el.querySelector("#feed-list"));
  });
}
