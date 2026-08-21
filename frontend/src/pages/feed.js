import { renderTabbar } from "../components/tabbar.js";

// TODO: post misti (foto sfide, presenze/streak, traguardi, annunci coach),
// filtri per categoria, reazioni emoji (brief, sezione 8.5).
export function renderFeed(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Feed</h1>
    <div class="card">
      <p class="mono" style="color:var(--mute)">I post del gruppo arrivano qui.</p>
    </div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());
}
