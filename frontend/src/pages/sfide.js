import { renderTabbar } from "../components/tabbar.js";

// TODO: classifica del mese (calcolata da partecipazioni_sfide), lista sfide attive
// con punti, sfida "Ricordati di bere" (brief, sezione 7 e 8.4).
export function renderSfide(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Sfide</h1>
    <div class="card">
      <p class="mono" style="color:var(--mute)">Classifica del mese e sfide attive arrivano qui.</p>
    </div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());
}
