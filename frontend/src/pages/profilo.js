import { renderTabbar } from "../components/tabbar.js";
import { logout } from "../auth.js";
import { navigate } from "../router.js";
import { api, ApiError } from "../api.js";

// TODO: dati pubblici vs privati, stato pagamento, achievements/milestones (brief, sezione 14).
export function renderProfilo(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Profilo</h1>
    <div id="profilo-content"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    <button class="btn" id="logout-btn" style="margin-top:20px">Esci</button>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  el.querySelector("#logout-btn").addEventListener("click", async () => {
    await logout();
    navigate("/login");
  });

  loadProfilo(el);
}

async function loadProfilo(el) {
  const content = el.querySelector("#profilo-content");
  try {
    const p = await api.get("/profilo/me");
    const nomeVisualizzato = p.nickname || p.nome || (p.role === "coach" ? "Coach" : "Atleta");

    if (!p.livello) {
      content.innerHTML = `
        <div class="card">
          <p style="font-weight:600">${nomeVisualizzato} ${p.cognome ?? ""}</p>
          <p class="mono" style="color:var(--mute); margin-top:8px">
            Nessun livello ancora — completa la prima settimana di allenamenti per sbloccarlo.
          </p>
        </div>
      `;
      return;
    }

    const { attuale, prossimo, settimaneCompletate } = p.livello;
    const settimaneAlProssimo = prossimo ? prossimo.settimaneMin - settimaneCompletate : null;

    content.innerHTML = `
      <div class="card">
        <p style="font-weight:600">${nomeVisualizzato} ${p.cognome ?? ""}</p>
      </div>
      <div class="card" style="margin-top:12px; text-align:center">
        <img src="/cards/card_final_${attuale.numero}.png" alt="Livello ${attuale.numero}"
             style="width:140px; height:140px; border-radius:12px; object-fit:cover" />
        <p style="font-weight:600; color:${attuale.colore}; margin-top:10px">Livello ${attuale.numero} — ${attuale.nome}</p>
        <p class="mono" style="color:var(--mute); font-size:13px">${settimaneCompletate} settimane cumulative</p>
        ${
          prossimo
            ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${settimaneAlProssimo} settiman${settimaneAlProssimo === 1 ? "a" : "e"} a Livello ${prossimo.numero} — ${prossimo.nome}</p>`
            : `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Livello massimo raggiunto</p>`
        }
      </div>
      <div class="card" style="margin-top:12px; display:flex; justify-content:space-around; text-align:center">
        <div>
          <p style="font-weight:600; font-size:18px">${p.xpTotale}</p>
          <p class="mono" style="color:var(--mute); font-size:12px">XP totali</p>
        </div>
        <div>
          <p style="font-weight:600; font-size:18px">${p.sfideCompletate}</p>
          <p class="mono" style="color:var(--mute); font-size:12px">Sfide</p>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}
