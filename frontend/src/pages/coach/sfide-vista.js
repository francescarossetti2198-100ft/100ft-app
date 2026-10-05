import { renderPaginaCoach } from "../../components/coach-shell.js";
import { montaSfide } from "../sfide.js";

// La pagina Sfide così come la vedono gli atleti (classifica + carosello dei mesi con
// coccarda), dentro la dashboard coach. Sola lettura: il modulo per creare/gestire le
// sfide resta in "Il mese › Gestione sfide". Niente Daily Drop (è solo per gli atleti).
export function renderCoachSfideVista(appEl) {
  renderPaginaCoach(appEl, { titolo: "Sfide" }, (el) => {
    el.innerHTML = `<div id="sfide-vista"><p class="mono" style="color:var(--mute)">Carico...</p></div>`;
    montaSfide(el.querySelector("#sfide-vista"), { conDailyDrop: false });
  });
}
