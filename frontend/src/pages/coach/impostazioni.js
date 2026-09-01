import { renderPaginaCoach } from "../../components/coach-shell.js";
import { fotoProfiloHtml, attachFotoUpload, initNotifiche } from "../profilo.js";
import { api } from "../../api.js";
import { logout } from "../../auth.js";
import { navigate } from "../../router.js";

export function renderCoachImpostazioni(appEl) {
  renderPaginaCoach(appEl, { titolo: "Impostazioni" }, async (el) => {
    el.innerHTML = `
      <div class="card" id="imp-foto"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>

      <div class="card" style="margin-top:16px">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">NOTIFICHE PUSH</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Ricevi la notifica per fare l'appello a fine allenamento.</p>
        <div id="notifiche-stato" style="margin-top:8px"><p class="mono" style="color:var(--mute); font-size:13px">Verifico...</p></div>
      </div>

      <div class="card" style="margin-top:16px">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">TEMA</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Usa il pulsante in alto a destra per passare da chiaro a scuro (o automatico).</p>
      </div>

      <button class="btn" id="imp-esci" style="width:100%; margin-top:20px; background:var(--surface-2); color:var(--text)">Esci</button>`;

    let p = {};
    try { p = await api.get("/profilo/me"); } catch { /* mostra comunque il placeholder */ }
    el.querySelector("#imp-foto").innerHTML = fotoProfiloHtml(p.fotoUrl, "C");
    attachFotoUpload(el, () => renderCoachImpostazioni(appEl));
    initNotifiche(el);

    el.querySelector("#imp-esci").addEventListener("click", async () => {
      await logout();
      navigate("/login");
    });
  });
}
