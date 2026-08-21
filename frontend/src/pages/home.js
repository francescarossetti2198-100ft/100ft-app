import { renderTabbar } from "../components/tabbar.js";

// TODO: anelli settimanali, carta livello, nota del coach, presenza di oggi,
// richieste pre-allenamento, "in sala oggi" (brief, sezione 8.2).
export function renderHome(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Home</h1>
    <div class="card">
      <p class="mono" style="color:var(--mute)">Anelli settimanali, presenza di oggi e nota del coach arrivano qui.</p>
    </div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());
}
