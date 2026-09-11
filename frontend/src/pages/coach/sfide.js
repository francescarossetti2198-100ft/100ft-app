import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initSfida, MESI, SEL_STYLE, CRITERI_TRAGUARDO, oraCorrente } from "../coach.js";

export function renderCoachSfide(appEl) {
  const { mese, anno } = oraCorrente();
  renderPaginaCoach(appEl, { titolo: "Gestione sfide" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <div id="sfide-elenco" style="margin-top:0">
          <p class="mono" style="color:var(--mute); font-size:13px">Carico...</p>
        </div>

        <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border)">
          <p class="mono" style="color:var(--mute); font-size:12px">NUOVA SFIDA</p>
          <div class="field" style="margin-top:10px">
            <label>Titolo</label>
            <input id="sfida-titolo" type="text" />
          </div>
          <div class="field">
            <label>Descrizione</label>
            <input id="sfida-descrizione" type="text" />
          </div>
          <div class="field">
            <label>Come si completa</label>
            <select id="sfida-tipo" style="${SEL_STYLE}">
              <option value="foto">Foto — l'atleta carica una foto</option>
              <option value="traguardo">Automatica — si completa da sola</option>
              <option value="presenza">Di gruppo — l'atleta conferma «fatto»</option>
            </select>
          </div>
          <div class="field" id="sfida-criterio-wrap" style="display:none">
            <label>Si completa quando l'atleta…</label>
            <select id="sfida-criterio" style="${SEL_STYLE}">
              ${CRITERI_TRAGUARDO.map((x) => `<option value="${x.v}">${x.label}</option>`).join("")}
            </select>
            <input id="sfida-criterio-n" type="number" min="1" max="99" value="6" hidden
                   style="margin-top:8px; ${SEL_STYLE}" />
          </div>
          <div class="field">
            <label>Mese della sfida</label>
            <div style="display:flex; gap:8px">
              <select id="sfida-mese" style="flex:2; ${SEL_STYLE}">
                ${MESI.map((m, i) => `<option value="${i + 1}" ${i + 1 === mese ? "selected" : ""}>${m}</option>`).join("")}
              </select>
              <input id="sfida-anno" type="number" value="${anno}" style="flex:1; ${SEL_STYLE}" />
            </div>
            <p class="mono" style="color:var(--mute); font-size:11px; margin-top:4px">
              La sfida dura tutto il mese, dal primo all'ultimo giorno.
            </p>
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:14px; margin:4px 0 10px; cursor:pointer">
            <input type="checkbox" id="sfida-flash" /> ⚡ Sfida lampo (badge dedicato, di pochi giorni)
          </label>
          <details id="sfida-date-precise" style="margin-bottom:10px">
            <summary class="mono" style="cursor:pointer; color:var(--mute); font-size:12px">Date precise (per le sfide lampo)</summary>
            <div style="display:flex; gap:10px; margin-top:8px">
              <div class="field" style="flex:1">
                <label>Inizio</label>
                <input id="sfida-inizio" type="date" />
              </div>
              <div class="field" style="flex:1">
                <label>Fine</label>
                <input id="sfida-fine" type="date" />
              </div>
            </div>
          </details>
          <p class="mono" style="color:var(--mute); font-size:12px">Ogni sfida completata vale 10 punti.</p>
          <p class="error-text" id="sfida-error" hidden></p>
          <p class="success-text" id="sfida-success" hidden>Sfida creata ✓</p>
          <button class="btn" id="sfida-crea" style="width:100%; margin-top:4px">Crea sfida</button>
        </div>
      </div>`;
    initSfida(el);
  });
}
