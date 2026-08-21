import { renderTabbar } from "../components/tabbar.js";

// TODO: timeline mesi (futuri bloccati), focus del mese, linee guida nutrizionali,
// merende fit (brief, sezione 6 e 8.3).
export function renderProgramma(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Programma</h1>
    <div class="card">
      <p class="mono" style="color:var(--mute)">Timeline mensile e merende fit arrivano qui.</p>
    </div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());
}
