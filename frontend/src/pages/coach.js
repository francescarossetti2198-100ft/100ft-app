import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError } from "../api.js";
import { getUser } from "../auth.js";
import { navigate } from "../router.js";

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const TIPO_SFIDA_LABEL = {
  presenza: "Sfida di gruppo",
  foto: "Sfida foto",
  valore_manuale: "Sfida personale",
};

const CATEGORIA_LABEL = {
  Mobilità: "🧘 Mobilità",
  Gambe: "🦵 Gambe",
  "Parte superiore": "💪 Parte superiore",
  Altro: "✏️ Altro",
};

function oraCorrente() {
  const now = new Date();
  return { mese: now.getUTCMonth() + 1, anno: now.getUTCFullYear() };
}

function oggiIso() {
  return new Date().toISOString().slice(0, 10);
}

export function renderCoach(appEl) {
  // Pannello riservato al coach — un atleta che arriva qui via URL diretto torna in Home.
  if (getUser()?.role !== "coach") {
    navigate("/");
    return;
  }

  const { mese, anno } = oraCorrente();

  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>Coach</h1>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">NOTA DEL GIORNO</p>
      <input id="nota-data" type="date" value="${oggiIso()}"
        style="margin-top:10px; background:var(--surface-2); border:1px solid var(--border);
               border-radius:8px; padding:10px; color:var(--text); font-family:inherit" />
      <div id="nota-status" style="margin-top:8px"></div>
      <textarea id="nota-testo" rows="3"
        style="width:100%; margin-top:8px; background:var(--surface-2); border:1px solid var(--border);
               border-radius:8px; padding:10px; color:var(--text); font-family:inherit; font-size:14px; resize:vertical"
        placeholder="Messaggio breve per oggi..."></textarea>
      <p class="error-text" id="nota-error" hidden style="margin-top:6px"></p>
      <p class="success-text" id="nota-success" hidden style="margin-top:6px">Salvata ✓</p>
      <button class="btn" id="nota-salva" style="width:100%; margin-top:10px">Salva nota</button>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">FOCUS DEL MESE / MERENDE FIT</p>
      <div style="display:flex; gap:8px; margin-top:10px">
        <select id="piano-mese" style="flex:2; background:var(--surface-2); border:1px solid var(--border);
                border-radius:8px; padding:10px; color:var(--text); font-family:inherit">
          ${MESI.map((m, i) => `<option value="${i + 1}" ${i + 1 === mese ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <input id="piano-anno" type="number" value="${anno}" style="flex:1; background:var(--surface-2);
               border:1px solid var(--border); border-radius:8px; padding:10px; color:var(--text)" />
      </div>

      <div class="field" style="margin-top:14px">
        <label>Focus del mese</label>
        <input id="piano-focus" type="text" placeholder="es. Forza" />
      </div>
      <div class="field">
        <label>Descrizione</label>
        <textarea id="piano-descrizione" rows="3"
          style="width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px;
                 padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px; resize:vertical"></textarea>
      </div>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:16px">MERENDE FIT</p>
      <div id="merende-rows" style="margin-top:8px; display:flex; flex-direction:column; gap:10px"></div>
      <button type="button" class="link-btn" id="merenda-aggiungi" style="margin-top:10px">+ aggiungi merenda</button>

      <p class="error-text" id="piano-error" hidden style="margin-top:10px"></p>
      <p class="success-text" id="piano-success" hidden style="margin-top:10px">Salvato ✓</p>
      <button class="btn" id="piano-salva" style="width:100%; margin-top:14px">Salva focus del mese</button>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">CREA SFIDA</p>
      <div class="field" style="margin-top:10px">
        <label>Titolo</label>
        <input id="sfida-titolo" type="text" />
      </div>
      <div class="field">
        <label>Descrizione</label>
        <input id="sfida-descrizione" type="text" />
      </div>
      <div class="field">
        <label>Tipo</label>
        <select id="sfida-tipo" style="background:var(--surface); border:1px solid var(--border); border-radius:8px;
                padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px">
          ${Object.entries(TIPO_SFIDA_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}
        </select>
      </div>
      <div style="display:flex; gap:10px">
        <div class="field" style="flex:1">
          <label>Punti</label>
          <input id="sfida-punti" type="number" value="10" min="0" />
        </div>
        <div class="field" style="flex:1">
          <label>Inizio</label>
          <input id="sfida-inizio" type="date" />
        </div>
        <div class="field" style="flex:1">
          <label>Fine</label>
          <input id="sfida-fine" type="date" />
        </div>
      </div>
      <p class="error-text" id="sfida-error" hidden></p>
      <p class="success-text" id="sfida-success" hidden>Sfida creata ✓</p>
      <button class="btn" id="sfida-crea" style="width:100%; margin-top:4px">Crea sfida</button>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">RICHIESTE PRE-ALLENAMENTO DI OGGI</p>
      <div id="richieste-list" style="margin-top:10px"><p class="mono" style="color:var(--mute)">Carico...</p></div>
      <button type="button" class="link-btn" id="richieste-refresh" style="margin-top:10px">Aggiorna</button>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">MESSAGGI</p>
      <div id="messaggi-atleti" style="margin-top:10px"><p class="mono" style="color:var(--mute)">Carico...</p></div>
      <div id="messaggi-thread" style="margin-top:14px"></div>
    </div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  initNota(el);
  initPiano(el);
  initSfida(el);
  initRichieste(el);
  initMessaggi(el);
}

function initNota(el) {
  const dataInput = el.querySelector("#nota-data");
  const status = el.querySelector("#nota-status");
  const testo = el.querySelector("#nota-testo");
  const errorEl = el.querySelector("#nota-error");
  const successEl = el.querySelector("#nota-success");

  function carica() {
    testo.value = "";
    const oggi = dataInput.value === oggiIso();
    api
      .get(`/nota-coach?data=${dataInput.value}`)
      .then((r) => {
        status.innerHTML = r.testo
          ? `<p class="mono" style="color:var(--mute); font-size:13px">Nota attuale: “${r.testo}”</p>`
          : `<p class="mono" style="color:var(--mute); font-size:13px">Nessuna nota per ${oggi ? "oggi" : "questa data"}.</p>`;
        if (r.testo) testo.value = r.testo;
      })
      .catch(() => {
        status.innerHTML = "";
      });
  }

  dataInput.addEventListener("change", carica);

  el.querySelector("#nota-salva").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;
    if (!testo.value.trim()) {
      errorEl.textContent = "Scrivi un testo";
      errorEl.hidden = false;
      return;
    }
    e.target.disabled = true;
    try {
      await api.post("/nota-coach", { testo: testo.value.trim(), data: dataInput.value });
      successEl.hidden = false;
      carica();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });

  carica();
}

function rigaMerenda(m = {}) {
  const row = document.createElement("div");
  row.className = "merenda-row";
  row.style.cssText = "border:1px solid var(--border); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px";
  row.innerHTML = `
    <input class="merenda-titolo" type="text" placeholder="Titolo" value="${m.titolo ?? ""}"
      style="background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text)" />
    <input class="merenda-descrizione" type="text" placeholder="Descrizione (opzionale)" value="${m.descrizione ?? ""}"
      style="background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text)" />
    <input class="merenda-link" type="text" placeholder="Link ricetta/video (opzionale)" value="${m.linkUrl ?? ""}"
      style="background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text)" />
    <div style="display:flex; align-items:center; gap:8px">
      <label class="mono" style="font-size:12px; color:var(--mute)">Per il giorno</label>
      <input class="merenda-data" type="date" value="${m.data ?? ""}"
        style="background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text)" />
    </div>
    <button type="button" class="link-btn merenda-rimuovi" style="align-self:flex-start; color:var(--livello-5)">Rimuovi</button>
  `;
  row.querySelector(".merenda-rimuovi").addEventListener("click", () => row.remove());
  return row;
}

function initPiano(el) {
  const meseSel = el.querySelector("#piano-mese");
  const annoInput = el.querySelector("#piano-anno");
  const focusInput = el.querySelector("#piano-focus");
  const descrizioneInput = el.querySelector("#piano-descrizione");
  const merendeRows = el.querySelector("#merende-rows");
  const errorEl = el.querySelector("#piano-error");
  const successEl = el.querySelector("#piano-success");

  async function carica() {
    errorEl.hidden = true;
    successEl.hidden = true;
    focusInput.value = "";
    descrizioneInput.value = "";
    merendeRows.innerHTML = "";

    const mese = Number(meseSel.value);
    const anno = Number(annoInput.value);
    try {
      const { mesi } = await api.get("/programma");
      const esistente = mesi.find((m) => m.mese === mese && m.anno === anno);
      if (!esistente) return;

      const dettaglio = await api.get(`/programma/${esistente.id}`);
      focusInput.value = dettaglio.focusTema ?? "";
      descrizioneInput.value = dettaglio.descrizione ?? "";
      for (const m of dettaglio.merende ?? []) merendeRows.appendChild(rigaMerenda(m));
    } catch {
      // Nessun piano esistente per questo mese o errore di rete — form vuoto, si crea da capo.
    }
  }

  meseSel.addEventListener("change", carica);
  annoInput.addEventListener("change", carica);
  el.querySelector("#merenda-aggiungi").addEventListener("click", () => merendeRows.appendChild(rigaMerenda()));

  el.querySelector("#piano-salva").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;

    const merende = [...merendeRows.querySelectorAll(".merenda-row")]
      .map((row) => ({
        titolo: row.querySelector(".merenda-titolo").value.trim(),
        descrizione: row.querySelector(".merenda-descrizione").value.trim() || undefined,
        linkUrl: row.querySelector(".merenda-link").value.trim() || undefined,
        data: row.querySelector(".merenda-data").value || undefined,
      }))
      .filter((m) => m.titolo);

    e.target.disabled = true;
    try {
      await api.post("/programma", {
        mese: Number(meseSel.value),
        anno: Number(annoInput.value),
        focusTema: focusInput.value.trim() || undefined,
        descrizione: descrizioneInput.value.trim() || undefined,
        merende,
      });
      successEl.hidden = false;
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });

  carica();
}

function initSfida(el) {
  const errorEl = el.querySelector("#sfida-error");
  const successEl = el.querySelector("#sfida-success");

  el.querySelector("#sfida-crea").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;

    const titolo = el.querySelector("#sfida-titolo").value.trim();
    const descrizione = el.querySelector("#sfida-descrizione").value.trim();
    const tipo = el.querySelector("#sfida-tipo").value;
    const punti = Number(el.querySelector("#sfida-punti").value);
    const dataInizio = el.querySelector("#sfida-inizio").value;
    const dataFine = el.querySelector("#sfida-fine").value;

    if (!titolo || !dataInizio || !dataFine) {
      errorEl.textContent = "Titolo, data di inizio e data di fine sono obbligatori";
      errorEl.hidden = false;
      return;
    }

    e.target.disabled = true;
    try {
      await api.post("/sfide", {
        titolo,
        descrizione: descrizione || undefined,
        tipo,
        punti,
        data_inizio: dataInizio,
        data_fine: dataFine,
      });
      successEl.hidden = false;
      el.querySelector("#sfida-titolo").value = "";
      el.querySelector("#sfida-descrizione").value = "";
      el.querySelector("#sfida-punti").value = "10";
      el.querySelector("#sfida-inizio").value = "";
      el.querySelector("#sfida-fine").value = "";
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });
}

function initRichieste(el) {
  const list = el.querySelector("#richieste-list");

  async function carica() {
    list.innerHTML = `<p class="mono" style="color:var(--mute)">Carico...</p>`;
    try {
      const { richieste } = await api.get("/richieste/oggi/coach");

      if (!richieste.length) {
        list.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessuna richiesta per oggi.</p>`;
        return;
      }

      list.innerHTML = richieste
        .map(
          (r) => `
            <div style="border-top:1px solid var(--border); padding:8px 0">
              <p style="font-size:14px"><strong>${r.nickname || r.nome}</strong></p>
              ${r.categoria ? `<p class="mono" style="color:var(--accent); font-size:13px; margin-top:2px">${CATEGORIA_LABEL[r.categoria] ?? r.categoria}</p>` : ""}
              ${r.testoLibero ? `<p style="font-size:13px; margin-top:2px">${r.testoLibero}</p>` : ""}
            </div>
          `
        )
        .join("");
    } catch (err) {
      list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
    }
  }

  el.querySelector("#richieste-refresh").addEventListener("click", carica);
  carica();
}

function formattaOraMessaggio(dataIso) {
  const d = new Date(dataIso.replace(" ", "T") + "Z");
  const oggi = new Date();
  const stessoGiorno = d.toDateString() === oggi.toDateString();
  const ora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (stessoGiorno) return ora;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${ora}`;
}

function bollaMessaggioHtml(m) {
  const allineamento = m.daCoach ? "flex-end" : "flex-start";
  const sfondo = m.daCoach ? "var(--accent)" : "var(--surface-2)";
  const colore = m.daCoach ? "#fff" : "var(--text)";
  return `
    <div style="display:flex; justify-content:${allineamento}">
      <div style="max-width:78%; background:${sfondo}; color:${colore}; padding:10px 14px; border-radius:14px">
        <p style="font-size:14px; white-space:pre-wrap">${m.testo}</p>
        <p class="mono" style="font-size:10px; opacity:0.7; margin-top:4px; text-align:right">${formattaOraMessaggio(m.creatoIl)}</p>
      </div>
    </div>
  `;
}

function initMessaggi(el) {
  const listEl = el.querySelector("#messaggi-atleti");
  const threadEl = el.querySelector("#messaggi-thread");
  let atletaSelezionato = null;

  async function caricaAtleti() {
    try {
      const { atleti } = await api.get("/messaggi/atleti");

      if (!atleti.length) {
        listEl.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun atleta registrato.</p>`;
        return;
      }

      listEl.innerHTML = atleti
        .map((a) => {
          const attivo = a.userId === atletaSelezionato;
          return `
            <button type="button" class="atleta-msg-btn" data-id="${a.userId}" data-nome="${a.nickname || a.nome}"
              style="display:flex; justify-content:space-between; align-items:center; width:100%; text-align:left;
                     padding:10px 0; border-top:1px solid var(--border); background:none; border-left:none; border-right:none; border-bottom:none;
                     cursor:pointer; color:var(--text); font-family:inherit; ${attivo ? "opacity:1" : ""}">
              <span>
                <span style="font-weight:${attivo ? 700 : 400}">${a.nickname || a.nome}</span>
                ${a.ultimoTesto ? `<span class="mono" style="color:var(--mute); font-size:12px; display:block; margin-top:2px">${a.ultimoTesto.slice(0, 40)}${a.ultimoTesto.length > 40 ? "…" : ""}</span>` : ""}
              </span>
              ${a.nonLetti > 0 ? `<span class="mono" style="background:var(--accent); color:#fff; border-radius:10px; padding:2px 8px; font-size:11px">${a.nonLetti}</span>` : ""}
            </button>
          `;
        })
        .join("");

      listEl.querySelectorAll(".atleta-msg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          atletaSelezionato = Number(btn.dataset.id);
          caricaThread(btn.dataset.nome);
          caricaAtleti();
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
    }
  }

  async function caricaThread(nome) {
    threadEl.innerHTML = `
      <p style="font-weight:600; border-top:1px solid var(--border); padding-top:12px">${nome}</p>
      <div id="thread-bolle" style="margin-top:10px; display:flex; flex-direction:column; gap:8px; max-height:320px; overflow-y:auto">
        <p class="mono" style="color:var(--mute)">Carico...</p>
      </div>
      <div style="display:flex; gap:8px; margin-top:10px">
        <input id="thread-testo" type="text" placeholder="Scrivi un messaggio..."
               style="flex:1; background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:10px 14px; color:var(--text)" />
        <button class="btn" id="thread-invia" style="border-radius:20px; padding:10px 16px">Invia</button>
      </div>
      <p class="error-text" id="thread-error" hidden style="margin-top:6px"></p>
    `;

    const bolleEl = threadEl.querySelector("#thread-bolle");
    try {
      const { messaggi } = await api.get(`/messaggi/${atletaSelezionato}`);
      bolleEl.innerHTML = messaggi.length
        ? messaggi.map(bollaMessaggioHtml).join("")
        : `<p class="mono" style="color:var(--mute); font-size:13px">Ancora nessun messaggio.</p>`;
      bolleEl.scrollTop = bolleEl.scrollHeight;
    } catch (err) {
      bolleEl.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
    }

    threadEl.querySelector("#thread-invia").addEventListener("click", async () => {
      const input = threadEl.querySelector("#thread-testo");
      const errorEl = threadEl.querySelector("#thread-error");
      const testo = input.value.trim();
      errorEl.hidden = true;
      if (!testo) return;

      try {
        await api.post(`/messaggi/${atletaSelezionato}`, { testo });
        input.value = "";
        await caricaThread(nome);
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
      }
    });
  }

  caricaAtleti();
}
