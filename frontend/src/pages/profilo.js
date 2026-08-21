import { renderTabbar } from "../components/tabbar.js";
import { logout } from "../auth.js";
import { navigate } from "../router.js";

// TODO: stats, carosello carte-livello, dati pubblici vs privati, stato pagamento
// (brief, sezione 8.6).
export function renderProfilo(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Profilo</h1>
    <div class="card">
      <p class="mono" style="color:var(--mute)">Stats, carte-livello e pagamenti arrivano qui.</p>
    </div>
    <button class="btn" id="logout-btn" style="margin-top:20px">Esci</button>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  el.querySelector("#logout-btn").addEventListener("click", async () => {
    await logout();
    navigate("/login");
  });
}
