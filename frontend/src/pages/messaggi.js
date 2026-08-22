import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";

function formattaOra(dataIso) {
  const d = new Date(dataIso.replace(" ", "T") + "Z");
  const oggi = new Date();
  const stessoGiorno = d.toDateString() === oggi.toDateString();
  const ora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (stessoGiorno) return ora;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${ora}`;
}

export function renderMessaggi(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Messaggi</h1>
    <p class="mono" style="color:var(--mute); font-size:13px">La tua conversazione con la coach</p>
    <div id="thread" style="margin-top:16px; display:flex; flex-direction:column; gap:10px">
      <p class="mono" style="color:var(--mute)">Carico...</p>
    </div>
    <div style="display:flex; gap:8px; margin-top:16px; position:sticky; bottom:80px">
      <input id="msg-testo" type="text" placeholder="Scrivi un messaggio..."
             style="flex:1; background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:10px 16px; color:var(--text)" />
      <button class="btn" id="msg-invia" style="border-radius:20px; padding:10px 18px">Invia</button>
    </div>
    <p class="error-text" id="msg-error" hidden style="margin-top:8px"></p>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadThread(el);

  el.querySelector("#msg-invia").addEventListener("click", () => inviaMessaggio(el));
  el.querySelector("#msg-testo").addEventListener("keydown", (e) => {
    if (e.key === "Enter") inviaMessaggio(el);
  });
}

function bollaHtml(m) {
  const allineamento = m.daCoach ? "flex-start" : "flex-end";
  const sfondo = m.daCoach ? "var(--surface-2)" : "var(--accent)";
  const colore = m.daCoach ? "var(--text)" : "#fff";
  return `
    <div style="display:flex; justify-content:${allineamento}">
      <div style="max-width:78%; background:${sfondo}; color:${colore}; padding:10px 14px; border-radius:14px">
        <p style="font-size:14px; white-space:pre-wrap">${m.testo}</p>
        <p class="mono" style="font-size:10px; opacity:0.7; margin-top:4px; text-align:right">${formattaOra(m.creatoIl)}</p>
      </div>
    </div>
  `;
}

async function loadThread(el) {
  const thread = el.querySelector("#thread");
  try {
    const { messaggi } = await api.get("/messaggi");
    if (!messaggi.length) {
      thread.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Ancora nessun messaggio — scrivi tu il primo.</p>`;
      return;
    }
    thread.innerHTML = messaggi.map(bollaHtml).join("");
  } catch (err) {
    thread.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
  }
}

async function inviaMessaggio(el) {
  const input = el.querySelector("#msg-testo");
  const errorEl = el.querySelector("#msg-error");
  const btn = el.querySelector("#msg-invia");
  errorEl.hidden = true;

  const testo = input.value.trim();
  if (!testo) return;

  btn.disabled = true;
  try {
    await api.post("/messaggi", { testo });
    input.value = "";
    await loadThread(el);
  } catch (err) {
    errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
  }
}
