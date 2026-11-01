import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initNota, initAnnuncio, oggiIso } from "../coach.js";

export function renderCoachComunicazioni(appEl) {
  renderPaginaCoach(appEl, { titolo: "Comunicazioni" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">NOTA DEL GIORNO</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">
          Messaggio breve mostrato agli atleti nella Home del giorno scelto.
        </p>
        <input id="nota-data" type="date" value="${oggiIso()}"
          style="margin-top:10px; background:var(--surface-2); border:1px solid var(--border);
                 border-radius:8px; padding:10px; color:var(--text); font-family:inherit" />
        <div id="nota-status" style="margin-top:8px"></div>
        <textarea id="nota-testo" rows="3"
          style="width:100%; margin-top:8px; background:var(--surface-2); border:1px solid var(--border);
                 border-radius:8px; padding:10px; color:var(--text); font-family:inherit; font-size:14px; resize:vertical"
          placeholder="Messaggio breve per quel giorno..."></textarea>
        <p class="error-text" id="nota-error" hidden style="margin-top:6px"></p>
        <p class="success-text" id="nota-success" hidden style="margin-top:6px">Salvata ✓</p>
        <button class="btn" id="nota-salva" style="width:100%; margin-top:10px">Salva nota</button>
      </div>

      <div class="card" style="margin-top:16px">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">ANNUNCIO NEL FEED</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">
          Compare nel Feed di tutti gli atleti come comunicazione della coach.
        </p>
        <textarea id="annuncio-testo" rows="3"
          style="width:100%; margin-top:8px; background:var(--surface-2); border:1px solid var(--border);
                 border-radius:8px; padding:10px; color:var(--text); font-family:inherit; font-size:14px; resize:vertical"
          placeholder="Es. Sabato palestra chiusa, ci vediamo lunedì 💪"></textarea>
        <p class="error-text" id="annuncio-error" hidden style="margin-top:6px"></p>
        <p class="success-text" id="annuncio-success" hidden style="margin-top:6px">Pubblicato nel Feed ✓</p>
        <button class="btn" id="annuncio-pub" style="width:100%; margin-top:10px">Pubblica nel Feed</button>
      </div>`;
    initNota(el);
    initAnnuncio(el);
  });
}
