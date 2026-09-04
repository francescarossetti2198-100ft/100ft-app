import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initPiano, MESI, SEL_STYLE, oraCorrente } from "../coach.js";
import { currentQuery } from "../../router.js";

const AREA_STYLE =
  "width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px; resize:vertical";

export function renderCoachMese(appEl) {
  const { mese, anno } = oraCorrente();
  const sez = currentQuery().get("sez") || "focus";

  renderPaginaCoach(appEl, { titolo: "Il mese" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <div style="display:flex; gap:8px">
          <select id="piano-mese" style="flex:2; ${SEL_STYLE}">
            ${MESI.map((m, i) => `<option value="${i + 1}" ${i + 1 === mese ? "selected" : ""}>${m}</option>`).join("")}
          </select>
          <input id="piano-anno" type="number" value="${anno}" style="flex:1; ${SEL_STYLE}" />
        </div>

        <details class="blocco-mese" data-sez="focus" style="margin-top:8px">
          <summary>Focus & obiettivi</summary>
          <div class="blocco-corpo">
            <div class="field" style="margin-top:8px">
              <label>Focus del mese (tema)</label>
              <input id="piano-focus" type="text" placeholder="es. MOVEMENT QUALITY & MOBILITY" />
            </div>
            <div class="field"><label>Obiettivo</label>
              <textarea id="piano-obiettivo" rows="2" style="${AREA_STYLE}"></textarea></div>
            <div class="field">
              <label>Perché questo mese <span class="mono" style="color:var(--mute); font-size:12px">— righe vuote = nuovo paragrafo</span></label>
              <textarea id="piano-perche" rows="5" style="${AREA_STYLE}"></textarea></div>
            <div class="field"><label>Risultato atteso</label>
              <textarea id="piano-risultato" rows="4" style="${AREA_STYLE}"></textarea></div>
          </div>
        </details>

        <details class="blocco-mese" data-sez="abitudini">
          <summary>Sane abitudini</summary>
          <div class="blocco-corpo">
            <div class="field" style="margin-top:8px"><label>Focus</label>
              <input id="piano-focus-nutri" type="text" placeholder="es. Regolarità e qualità alimentare" /></div>
            <div class="field">
              <label>Linee guida <span class="mono" style="color:var(--mute); font-size:12px">— una per riga</span></label>
              <textarea id="piano-linee" rows="6" style="${AREA_STYLE}"></textarea></div>
            <div class="field"><label>Obiettivo nutrizionale</label>
              <textarea id="piano-obiettivo-nutri" rows="2" style="${AREA_STYLE}"></textarea></div>
          </div>
        </details>

        <details class="blocco-mese" data-sez="merende">
          <summary>Merende fit</summary>
          <div class="blocco-corpo">
            <p class="mono" id="merende-mese-nota" style="color:var(--mute); font-size:12px; margin-top:6px">
              Le merende finiscono nel mese selezionato in alto. La data "Per il giorno" dice solo
              agli atleti in che giorno vale — NON sposta la merenda in un altro mese.
            </p>
            <div id="merende-calendario" style="margin-top:12px"></div>
            <details class="blocco-mese" id="merende-dettaglio" style="margin-top:12px">
              <summary><span id="merende-summary">Merende del mese</span></summary>
              <div class="blocco-corpo">
                <div id="merende-rows" style="display:flex; flex-direction:column; gap:10px"></div>
                <button type="button" class="link-btn" id="merenda-aggiungi" style="margin-top:10px">+ aggiungi merenda</button>
              </div>
            </details>
          </div>
        </details>

        <p class="error-text" id="piano-error" hidden style="margin-top:10px"></p>
        <p class="success-text" id="piano-success" hidden style="margin-top:10px">Salvato ✓</p>
        <button class="btn" id="piano-salva" style="width:100%; margin-top:14px">Salva contenuto del mese</button>
      </div>`;

    const target = el.querySelector(`details[data-sez="${sez}"]`) || el.querySelector('details[data-sez="focus"]');
    if (target) target.open = true;

    initPiano(el);
  });
}
