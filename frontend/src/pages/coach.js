import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError, mediaUrl } from "../api.js";
import { getUser } from "../auth.js";
import { navigate } from "../router.js";
import { etichettaCategoria } from "../richieste-categorie.js";

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const TIPO_SFIDA_LABEL = {
  presenza: "Sfida di gruppo",
  foto: "Sfida foto",
  valore_manuale: "Sfida personale",
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
      <p class="sezione-label">Contenuto del mese</p>
      <div style="display:flex; gap:8px; margin-top:12px">
        <select id="piano-mese" style="flex:2; background:var(--surface-2); border:1px solid var(--border);
                border-radius:8px; padding:10px; color:var(--text); font-family:inherit">
          ${MESI.map((m, i) => `<option value="${i + 1}" ${i + 1 === mese ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <input id="piano-anno" type="number" value="${anno}" style="flex:1; background:var(--surface-2);
               border:1px solid var(--border); border-radius:8px; padding:10px; color:var(--text)" />
      </div>

      <div class="field" style="margin-top:14px">
        <label>Focus del mese (tema)</label>
        <input id="piano-focus" type="text" placeholder="es. MOVEMENT QUALITY & MOBILITY" />
      </div>
      <div class="field">
        <label>Obiettivo</label>
        <textarea id="piano-obiettivo" rows="2"
          style="width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px;
                 padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px; resize:vertical"></textarea>
      </div>
      <div class="field">
        <label>Perché questo mese <span class="mono" style="color:var(--mute); font-size:12px">— righe vuote = nuovo paragrafo</span></label>
        <textarea id="piano-perche" rows="5"
          style="width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px;
                 padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px; resize:vertical"></textarea>
      </div>
      <div class="field">
        <label>Risultato atteso</label>
        <textarea id="piano-risultato" rows="4"
          style="width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px;
                 padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px; resize:vertical"></textarea>
      </div>

      <p class="sezione-label" style="margin-top:20px">Sane abitudini</p>
      <div class="field" style="margin-top:12px">
        <label>Focus</label>
        <input id="piano-focus-nutri" type="text" placeholder="es. Regolarità e qualità alimentare" />
      </div>
      <div class="field">
        <label>Linee guida <span class="mono" style="color:var(--mute); font-size:12px">— una per riga</span></label>
        <textarea id="piano-linee" rows="6"
          style="width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px;
                 padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px; resize:vertical"></textarea>
      </div>
      <div class="field">
        <label>Obiettivo nutrizionale</label>
        <textarea id="piano-obiettivo-nutri" rows="2"
          style="width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px;
                 padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px; resize:vertical"></textarea>
      </div>

      <p class="sezione-label" style="margin-top:20px">Merende fit</p>
      <div id="merende-rows" style="margin-top:10px; display:flex; flex-direction:column; gap:10px"></div>
      <button type="button" class="link-btn" id="merenda-aggiungi" style="margin-top:10px">+ aggiungi merenda</button>

      <p class="error-text" id="piano-error" hidden style="margin-top:10px"></p>
      <p class="success-text" id="piano-success" hidden style="margin-top:10px">Salvato ✓</p>
      <button class="btn" id="piano-salva" style="width:100%; margin-top:14px">Salva contenuto del mese</button>
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
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  initNota(el);
  initPiano(el);
  initSfida(el);
  initRichieste(el);
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
  row.dataset.fotoUrl = m.fotoUrl ?? "";
  const inputStile = "background:var(--surface-2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text)";
  row.innerHTML = `
    <input class="merenda-titolo" type="text" placeholder="Titolo (opzionale)" value="${m.titolo ?? ""}" style="${inputStile}" />
    <textarea class="merenda-descrizione" rows="3" placeholder="Descrizione — vai a capo per fare un elenco (una riga = un punto)" style="${inputStile}; resize:vertical; font:inherit">${m.descrizione ?? ""}</textarea>
    <input class="merenda-link" type="text" placeholder="Link video ricetta Instagram (opzionale)" value="${m.linkUrl ?? ""}" style="${inputStile}" />

    <div style="display:flex; flex-direction:column; gap:8px">
      <img class="merenda-foto-preview" alt="Anteprima grafica" style="max-width:100%; width:auto; max-height:200px; border-radius:8px; object-fit:contain; align-self:flex-start; border:1px solid var(--border); display:${m.fotoUrl ? "block" : "none"}"${m.fotoUrl ? ` src="${mediaUrl(m.fotoUrl)}"` : ""} />
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap">
        <label class="link-btn" style="cursor:pointer">
          <span class="merenda-foto-testo">${m.fotoUrl ? "Cambia grafica" : "Aggiungi grafica"}</span>
          <input class="merenda-foto-input" type="file" accept="image/*" hidden />
        </label>
        <button type="button" class="link-btn merenda-foto-rimuovi" style="color:var(--livello-5); display:${m.fotoUrl ? "inline" : "none"}">Rimuovi</button>
      </div>
      <p class="error-text merenda-foto-error" hidden style="font-size:12px"></p>
    </div>

    <div style="display:flex; align-items:center; gap:8px">
      <label class="mono" style="font-size:12px; color:var(--mute)">Per il giorno</label>
      <input class="merenda-data" type="date" value="${m.data ?? ""}" style="${inputStile}" />
    </div>
    <button type="button" class="link-btn merenda-rimuovi" style="align-self:flex-start; color:var(--livello-5)">Rimuovi</button>
  `;

  const preview = row.querySelector(".merenda-foto-preview");
  const testo = row.querySelector(".merenda-foto-testo");
  const fileInput = row.querySelector(".merenda-foto-input");
  const rimuoviFoto = row.querySelector(".merenda-foto-rimuovi");
  const fotoError = row.querySelector(".merenda-foto-error");

  function mostraFoto(url) {
    row.dataset.fotoUrl = url || "";
    if (url) {
      preview.src = mediaUrl(url);
      preview.style.display = "block";
    } else {
      preview.removeAttribute("src");
      preview.style.display = "none";
    }
    rimuoviFoto.style.display = url ? "inline" : "none";
    testo.textContent = url ? "Cambia grafica" : "Aggiungi grafica";
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    fotoError.hidden = true;
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const res = await api.postForm("/programma/merenda-foto", fd);
      mostraFoto(res.fotoUrl);
    } catch (err) {
      fotoError.textContent = err instanceof ApiError ? err.message : "Upload non riuscito";
      fotoError.hidden = false;
    } finally {
      fileInput.value = "";
    }
  });

  rimuoviFoto.addEventListener("click", () => mostraFoto(""));
  row.querySelector(".merenda-rimuovi").addEventListener("click", () => row.remove());
  return row;
}

function initPiano(el) {
  const meseSel = el.querySelector("#piano-mese");
  const annoInput = el.querySelector("#piano-anno");
  const campi = {
    focusTema: el.querySelector("#piano-focus"),
    obiettivo: el.querySelector("#piano-obiettivo"),
    percheMese: el.querySelector("#piano-perche"),
    risultatoAtteso: el.querySelector("#piano-risultato"),
    focusNutrizionale: el.querySelector("#piano-focus-nutri"),
    lineeGuidaNutrizionali: el.querySelector("#piano-linee"),
    obiettivoNutrizionale: el.querySelector("#piano-obiettivo-nutri"),
  };
  const merendeRows = el.querySelector("#merende-rows");
  const errorEl = el.querySelector("#piano-error");
  const successEl = el.querySelector("#piano-success");

  // Vero solo quando le merende del mese corrente sono state caricate con successo (o è un
  // mese nuovo senza merende). Se il caricamento fallisce restiamo a false e il salvataggio
  // NON invia il campo `merende` → il worker lascia intatte quelle già salvate.
  let merendeSincronizzate = false;

  async function carica() {
    errorEl.hidden = true;
    successEl.hidden = true;
    for (const input of Object.values(campi)) input.value = "";
    merendeRows.innerHTML = "";
    merendeSincronizzate = false;

    const mese = Number(meseSel.value);
    const anno = Number(annoInput.value);
    try {
      const { mesi } = await api.get("/programma");
      const esistente = mesi.find((m) => m.mese === mese && m.anno === anno);
      if (!esistente) {
        merendeSincronizzate = true; // mese nuovo: nessuna merenda, form vuoto di proposito
        return;
      }

      const dettaglio = await api.get(`/programma/${esistente.id}`);
      for (const [chiave, input] of Object.entries(campi)) input.value = dettaglio[chiave] ?? "";
      for (const m of dettaglio.merende ?? []) merendeRows.appendChild(rigaMerenda(m));
      merendeSincronizzate = true;
    } catch {
      // Errore di rete: non sappiamo lo stato reale delle merende — non toccarle al salvataggio.
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
        titolo: row.querySelector(".merenda-titolo").value.trim() || undefined,
        descrizione: row.querySelector(".merenda-descrizione").value.trim() || undefined,
        linkUrl: row.querySelector(".merenda-link").value.trim() || undefined,
        data: row.querySelector(".merenda-data").value || undefined,
        fotoUrl: row.dataset.fotoUrl || undefined,
      }))
      .filter((m) => m.titolo || m.descrizione || m.linkUrl || m.fotoUrl);

    e.target.disabled = true;
    try {
      const payload = { mese: Number(meseSel.value), anno: Number(annoInput.value) };
      if (merendeSincronizzate) payload.merende = merende;
      for (const [chiave, input] of Object.entries(campi)) {
        payload[chiave] = input.value.trim() || undefined;
      }
      await api.post("/programma", payload);
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
      const { richieste, conteggi } = await api.get("/richieste/oggi/coach");

      if (!richieste.length) {
        list.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessuna richiesta per oggi.</p>`;
        return;
      }

      const conteggiHtml = conteggi && conteggi.length
        ? `<p class="mono" style="font-size:13px; line-height:1.8; padding-bottom:8px">
             ${conteggi.map((x) => `${etichettaCategoria(x.categoria)}&nbsp;<strong>${x.n}</strong>`).join(" · ")}
           </p>`
        : "";

      list.innerHTML =
        conteggiHtml +
        richieste
          .map(
            (r) => `
            <div style="border-top:1px solid var(--border); padding:8px 0">
              <p style="font-size:14px"><strong>${r.nickname || r.nome}</strong></p>
              ${r.categoria ? `<p class="mono" style="color:var(--accent); font-size:13px; margin-top:2px">${etichettaCategoria(r.categoria)}</p>` : ""}
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
