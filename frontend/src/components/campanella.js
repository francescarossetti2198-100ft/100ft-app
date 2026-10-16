import { api } from "../api.js";
import { getUser } from "../auth.js";
import { currentPath, navigate } from "../router.js";

// Campanella fissa in alto a destra, accanto all'interruttore del tema — solo per gli atleti.
// Il numerino rosso = notifiche nuove (worker/src/lib/notifiche.ts). Niente push: il conteggio
// si aggiorna quando si cambia pagina, quando si torna sull'app e ogni minuto.
const ICONA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>`;

const PAGINE_SENZA = ["/login", "/registrati", "/password-dimenticata", "/reset-password"];

let btn;
let badge;

function visibile() {
  return getUser()?.role === "atleta" && !PAGINE_SENZA.includes(currentPath());
}

function mostraNumero(n) {
  if (!badge) return;
  badge.hidden = !n;
  badge.textContent = n > 9 ? "9+" : String(n);
  btn.setAttribute("aria-label", n ? `Notifiche: ${n} nuove` : "Notifiche");
}

export async function aggiornaCampanella() {
  if (!btn) return;
  btn.hidden = !visibile();
  if (btn.hidden) return;
  // Sulla pagina Notifiche si sta già guardando tutto.
  if (currentPath() === "/notifiche") {
    mostraNumero(0);
    return;
  }
  try {
    const { nuove } = await api.get("/notifiche/conteggio");
    mostraNumero(nuove);
  } catch {
    // rete assente: resta l'ultimo numero mostrato
  }
}

export function mountCampanella() {
  if (document.getElementById("campanella")) return;
  btn = document.createElement("button");
  btn.id = "campanella";
  btn.type = "button";
  btn.className = "theme-toggle campanella";
  btn.innerHTML = `${ICONA}<span class="campanella-badge" hidden></span>`;
  btn.setAttribute("aria-label", "Notifiche");
  btn.title = "Notifiche";
  btn.hidden = true;
  badge = btn.querySelector(".campanella-badge");
  btn.addEventListener("click", () => navigate("/notifiche"));
  document.body.appendChild(btn);

  window.addEventListener("hashchange", aggiornaCampanella);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) aggiornaCampanella();
  });
  setInterval(() => {
    if (!document.hidden) aggiornaCampanella();
  }, 60 * 1000);
  aggiornaCampanella();
}
