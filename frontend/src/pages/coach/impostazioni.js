import { renderPaginaCoach } from "../../components/coach-shell.js";
import { fotoProfiloHtml, attachFotoUpload, initNotifiche, apriPersonalizzaFoto } from "../profilo.js";
import { api } from "../../api.js";
import { logout } from "../../auth.js";
import { navigate } from "../../router.js";

export function renderCoachImpostazioni(appEl) {
  renderPaginaCoach(appEl, { titolo: "Impostazioni" }, async (el) => {
    el.innerHTML = `
      <div class="card" id="imp-foto" style="position:relative"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>

      <div class="card" style="margin-top:16px">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">NOTIFICHE PUSH</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Notifica per fare l'appello a fine allenamento. Sotto puoi anche attivare i promemoria per bere e per la merenda.</p>
        <div id="notifiche-stato" style="margin-top:8px"><p class="mono" style="color:var(--mute); font-size:13px">Verifico...</p></div>
        <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:10px">
          <button class="btn" id="imp-prova-drop" style="width:100%; background:var(--surface-2); color:var(--text)">Prova il Daily Drop (solo a te)</button>
          <p class="mono" id="imp-prova-drop-esito" hidden style="font-size:12px; margin-top:6px"></p>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">TEMA</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Usa il pulsante in alto a destra per passare da chiaro a scuro (o automatico).</p>
      </div>

      <button class="btn" id="imp-esci" style="width:100%; margin-top:20px; background:var(--surface-2); color:var(--text)">Esci</button>`;

    let p = {};
    try { p = await api.get("/profilo/me"); } catch { /* mostra comunque il placeholder */ }
    // Foto + anello personalizzato (come gli atleti) — così compare accanto ai post nel Feed.
    el.querySelector("#imp-foto").innerHTML = `
      <button type="button" class="link-btn" id="imp-personalizza" aria-label="Personalizza la tua foto"
        style="position:absolute; top:12px; right:12px; color:var(--text); line-height:0; padding:4px">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
      </button>
      ${fotoProfiloHtml(p.fotoUrl, "C", true, p.fotoPersonalizzazione)}
      <p class="mono" style="color:var(--mute); font-size:11px; text-align:center; margin-top:8px">
        La foto e l'anello compaiono accanto ai tuoi messaggi nel Feed.
      </p>`;
    attachFotoUpload(el, () => renderCoachImpostazioni(appEl));
    el.querySelector("#imp-personalizza").addEventListener("click", () =>
      apriPersonalizzaFoto({ fotoUrl: p.fotoUrl, fotoPersonalizzazione: p.fotoPersonalizzazione, nome: "Coach" }, () =>
        renderCoachImpostazioni(appEl)
      )
    );
    initNotifiche(el, true); // anche la coach può attivare i promemoria bere / merenda

    el.querySelector("#imp-prova-drop").addEventListener("click", async (e) => {
      const esito = el.querySelector("#imp-prova-drop-esito");
      e.target.disabled = true;
      e.target.textContent = "Invio…";
      try {
        const { inviate } = await api.post("/daily-drop/prova");
        esito.textContent = inviate
          ? "Inviata ✓ — dovrebbe arrivarti come la ricevono gli atleti."
          : "Nessun dispositivo ha risposto. Attiva le notifiche qui sopra e riprova.";
        esito.style.color = inviate ? "var(--livello-1)" : "var(--livello-5)";
      } catch (err) {
        esito.textContent = err?.message || "Non è stato possibile inviare la prova.";
        esito.style.color = "var(--livello-5)";
      } finally {
        esito.hidden = false;
        e.target.disabled = false;
        e.target.textContent = "Prova il Daily Drop (solo a te)";
      }
    });

    el.querySelector("#imp-esci").addEventListener("click", async () => {
      await logout();
      navigate("/login");
    });
  });
}
