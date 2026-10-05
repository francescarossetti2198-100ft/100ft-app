import { renderPaginaCoach } from "../../components/coach-shell.js";
import { montaElencoAtleti } from "../profilo.js";

export function renderCoachAtleti(appEl) {
  renderPaginaCoach(appEl, { titolo: "Atleti" }, (el) => montaElencoAtleti(el));
}
