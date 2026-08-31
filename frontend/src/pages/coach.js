import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError, mediaUrl } from "../api.js";
import { getUser } from "../auth.js";
import { navigate } from "../router.js";
import { etichettaCategoria } from "../richieste-categorie.js";
import { PIANI } from "../abbonamenti.js";

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// Stile condiviso dei <select> della dashboard.
const SEL_STYLE =
  "background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 12px; color:var(--text); font-family:inherit; font-size:15px";

// Criteri per le sfide "traguardo": si completano da sole quando l'atleta li raggiunge.
const CRITERI_TRAGUARDO = [
  { v: "profilo_completo", label: "ha completato profilo + «I tuoi dati»" },
  { v: "obiettivi_completi", label: "ha compilato gli obiettivi personali" },
  { v: "daily_drop", label: "ha fatto almeno un daily drop" },
  { v: "presenze", label: "raggiunge N presenze confermate" },
];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Riga leggibile per una sfida nell'elenco della dashboard.
function descriviSfida(s) {
  if (s.tipo === "foto") return "📸 Foto";
  if (s.tipo !== "traguardo") return "👋 Di gruppo";
  const c = s.criterio || "";
  if (c === "profilo_completo") return "🏅 Automatica — profilo completo";
  if (c === "obiettivi_completi") return "🏅 Automatica — obiettivi compilati";
  if (c === "daily_drop") return "🏅 Automatica — un daily drop";
  const m = c.match(/^presenze:(\d+)$/);
  if (m) return `🏅 Automatica — ${m[1]} presenze`;
  return "🏅 Automatica";
}

// Primo e ultimo giorno (YYYY-MM-DD) di un mese dato anno + mese 1-12.
function estremiMese(anno, mese) {
  return {
    inizio: `${anno}-${String(mese).padStart(2, "0")}-01`,
    fine: new Date(Date.UTC(anno, mese, 0)).toISOString().slice(0, 10),
  };
}

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
      <p class="mono" style="color:var(--mute); font-size:12px">ANNUNCIO NEL FEED</p>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:6px">
        Compare nel Feed di tutti gli atleti come comunicazione della coach.</p>
      <textarea id="annuncio-testo" rows="3"
        style="width:100%; margin-top:8px; background:var(--surface-2); border:1px solid var(--border);
               border-radius:8px; padding:10px; color:var(--text); font-family:inherit; font-size:14px; resize:vertical"
        placeholder="Es. Sabato palestra chiusa, ci vediamo lunedì 💪"></textarea>
      <p class="error-text" id="annuncio-error" hidden style="margin-top:6px"></p>
      <p class="success-text" id="annuncio-success" hidden style="margin-top:6px">Pubblicato nel Feed ✓</p>
      <button class="btn" id="annuncio-pub" style="width:100%; margin-top:10px">Pubblica nel Feed</button>
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
      <p class="mono" id="merende-mese-nota" style="color:var(--mute); font-size:12px; margin-top:6px">
        Le merende finiscono nel mese selezionato in alto. La data "Per il giorno"
        dice solo agli atleti in che giorno vale — NON sposta la merenda in un altro mese.
      </p>
      <div id="merende-calendario" style="margin-top:12px"></div>
      <details class="blocco-mese" id="merende-dettaglio" style="margin-top:12px">
        <summary><span id="merende-summary">Merende del mese</span></summary>
        <div class="blocco-corpo">
          <div id="merende-rows" style="display:flex; flex-direction:column; gap:10px"></div>
          <button type="button" class="link-btn" id="merenda-aggiungi" style="margin-top:10px">+ aggiungi merenda</button>
        </div>
      </details>

      <p class="error-text" id="piano-error" hidden style="margin-top:10px"></p>
      <p class="success-text" id="piano-success" hidden style="margin-top:10px">Salvato ✓</p>
      <button class="btn" id="piano-salva" style="width:100%; margin-top:14px">Salva contenuto del mese</button>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">SFIDE</p>

      <div id="sfide-elenco" style="margin-top:10px">
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
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">SUDDIVISIONI</p>
      <p class="mono" style="color:var(--mute); font-size:11px; margin-top:4px">Bozza — imposta le % mancanti quando hai deciso.</p>
      <div style="display:flex; gap:8px; margin-top:10px">
        <select id="sudd-mese" style="flex:2; ${SEL_STYLE}">
          ${MESI.map((m, i) => `<option value="${i + 1}" ${i + 1 === mese ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <input id="sudd-anno" type="number" value="${anno}" style="flex:1; ${SEL_STYLE}" />
      </div>
      <div id="sudd-body" style="margin-top:12px"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">APPELLO</p>
      <select id="appello-data" style="margin-top:10px; background:var(--surface-2); border:1px solid var(--border);
              border-radius:8px; padding:10px; color:var(--text); font-family:inherit; font-size:15px"></select>
      <div id="appello-lista" style="margin-top:10px"><p class="mono" style="color:var(--mute)">Carico...</p></div>
      <p class="error-text" id="appello-error" hidden></p>
      <p class="success-text" id="appello-success" hidden>Appello confermato ✓</p>
      <button class="btn" id="appello-salva" style="width:100%; margin-top:8px" hidden>Conferma appello</button>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">GIORNI DI CHIUSURA</p>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:6px">
        Festività o palestra chiusa: quella settimana gli anelli diventano 2/2 invece di 3/3.
      </p>
      <div style="display:flex; gap:8px; margin-top:10px; align-items:flex-end; flex-wrap:wrap">
        <div class="field" style="flex:1; min-width:130px; margin:0">
          <label>Giorno</label>
          <input id="chiusura-data" type="date" style="${SEL_STYLE}" />
        </div>
        <div class="field" style="flex:2; min-width:130px; margin:0">
          <label>Motivo (facoltativo)</label>
          <input id="chiusura-motivo" type="text" placeholder="es. Ferragosto" style="${SEL_STYLE}" />
        </div>
        <button class="btn" id="chiusura-aggiungi" style="background:var(--surface-2); color:var(--text)">Aggiungi</button>
      </div>
      <p class="error-text" id="chiusura-error" hidden style="margin-top:6px"></p>
      <div id="chiusura-lista" style="margin-top:10px"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>
    </div>

    <div class="card" style="margin-top:16px">
      <p class="mono" style="color:var(--mute); font-size:12px">RICHIESTE PRE-ALLENAMENTO DI OGGI</p>
      <div id="richieste-list" style="margin-top:10px"><p class="mono" style="color:var(--mute)">Carico...</p></div>
      <button type="button" class="link-btn" id="richieste-refresh" style="margin-top:10px">Aggiorna</button>
    </div>

    <p class="mono" style="color:var(--mute); font-size:11px; text-align:center; margin-top:20px; opacity:.7">
      versione ${typeof __BUILD_STAMP__ !== "undefined" ? __BUILD_STAMP__ : "dev"}
    </p>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  initNota(el);
  initAnnuncio(el);
  initPiano(el);
  initSfida(el);
  initSuddivisioni(el);
  initAppello(el);
  initChiusure(el);
  initRichieste(el);
}

// Giorni di chiusura / festività: tolti dal conteggio settimanale degli anelli.
function initChiusure(el) {
  const dataInput = el.querySelector("#chiusura-data");
  const motivoInput = el.querySelector("#chiusura-motivo");
  const errorEl = el.querySelector("#chiusura-error");
  const lista = el.querySelector("#chiusura-lista");

  const fmt = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const g = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${["dom", "lun", "mar", "mer", "gio", "ven", "sab"][g]} ${d} ${MESI[m - 1].toLowerCase()} ${y}`;
  };

  async function carica() {
    let giorni;
    try {
      ({ giorni } = await api.get("/chiusure"));
    } catch {
      lista.innerHTML = `<p class="error-text">Impossibile caricare</p>`;
      return;
    }
    lista.innerHTML = giorni.length
      ? giorni
          .map(
            (g) => `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-top:1px solid var(--border)">
              <span style="font-size:13px">${fmt(g.data)}${g.motivo ? ` <span class="mono" style="color:var(--mute); font-size:11px">· ${esc(g.motivo)}</span>` : ""}</span>
              <button type="button" class="link-btn chiusura-del" data-data="${g.data}" style="color:var(--livello-5); flex-shrink:0; font-size:16px; text-decoration:none">🗑</button>
            </div>`
          )
          .join("")
      : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun giorno di chiusura.</p>`;

    lista.querySelectorAll(".chiusura-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api.del(`/chiusure/${btn.dataset.data}`);
          await carica();
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Errore imprevisto");
          btn.disabled = false;
        }
      });
    });
  }

  el.querySelector("#chiusura-aggiungi").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    if (!dataInput.value) {
      errorEl.textContent = "Scegli un giorno";
      errorEl.hidden = false;
      return;
    }
    e.target.disabled = true;
    try {
      await api.post("/chiusure", { data: dataInput.value, motivo: motivoInput.value.trim() || undefined });
      dataInput.value = "";
      motivoInput.value = "";
      await carica();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });

  carica();
}

function formatGiornoBreve(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const g = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dom
  const nomi = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  return `${nomi[g]} ${d}/${m}`;
}

// Appello digitale: il coach conferma chi era davvero presente all'allenamento; solo così
// scattano i 10 punti presenza. Modificabile anche per le date passate.
function initAppello(el) {
  const sel = el.querySelector("#appello-data");
  const lista = el.querySelector("#appello-lista");
  const btn = el.querySelector("#appello-salva");
  const errorEl = el.querySelector("#appello-error");
  const successEl = el.querySelector("#appello-success");
  let sessioneId = null;

  async function carica() {
    errorEl.hidden = true;
    successEl.hidden = true;
    lista.innerHTML = `<p class="mono" style="color:var(--mute)">Carico...</p>`;

    let d;
    try {
      d = await api.get(`/presenze/appello${sel.value ? `?data=${sel.value}` : ""}`);
    } catch (err) {
      lista.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
      return;
    }

    if (!sel.dataset.pop && d.giorniRecenti?.length) {
      sel.innerHTML = d.giorniRecenti
        .map((g) => `<option value="${g}">${g === oggiIso() ? "Oggi" : formatGiornoBreve(g)}</option>`)
        .join("");
      sel.value = d.data;
      sel.dataset.pop = "1";
    }

    if (!d.sessione) {
      sessioneId = null;
      btn.hidden = true;
      lista.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun allenamento in questa data.</p>`;
      return;
    }

    sessioneId = d.sessione.id;
    btn.hidden = false;
    btn.textContent = d.confermato ? "Aggiorna appello" : "Conferma appello";

    lista.innerHTML = d.atleti.length
      ? d.atleti
          .map((a) => {
            const nome = [a.nome, a.cognome].filter(Boolean).join(" ") || a.nickname || a.nome;
            const spuntato = a.confermata || a.richiesta ? "checked" : "";
            const tag = a.richiesta
              ? `<span class="mono" style="color:var(--accent); font-size:11px; white-space:nowrap">ha prenotato</span>`
              : "";
            return `
              <label style="display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border)">
                <input type="checkbox" class="appello-check" data-user-id="${a.userId}" ${spuntato} />
                <span style="flex:1; font-size:14px">${nome}</span>${tag}
              </label>`;
          })
          .join("")
      : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun atleta.</p>`;
  }

  sel.addEventListener("change", carica);

  btn.addEventListener("click", async () => {
    if (!sessioneId) return;
    errorEl.hidden = true;
    successEl.hidden = true;
    const presentiUserIds = [...lista.querySelectorAll(".appello-check:checked")].map((c) => Number(c.dataset.userId));
    btn.disabled = true;
    try {
      await api.post("/presenze/appello", { data: sel.value, sessioneId, presentiUserIds });
      successEl.hidden = false;
      await carica();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  carica();
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

function initAnnuncio(el) {
  const testo = el.querySelector("#annuncio-testo");
  const errorEl = el.querySelector("#annuncio-error");
  const successEl = el.querySelector("#annuncio-success");

  el.querySelector("#annuncio-pub").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;
    if (!testo.value.trim()) {
      errorEl.textContent = "Scrivi un testo";
      errorEl.hidden = false;
      return;
    }
    e.target.disabled = true;
    try {
      await api.post("/feed/annuncio", { testo: testo.value.trim() });
      successEl.hidden = false;
      testo.value = "";
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });
}

function rigaMerenda(m = {}, onChange = () => {}) {
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
  row.querySelector(".merenda-rimuovi").addEventListener("click", () => {
    row.remove();
    onChange();
  });
  row.querySelector(".merenda-data").addEventListener("change", () => onChange());
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
  const calWrap = el.querySelector("#merende-calendario");
  const dettaglioMerende = el.querySelector("#merende-dettaglio");
  const summaryMerende = el.querySelector("#merende-summary");
  const errorEl = el.querySelector("#piano-error");
  const successEl = el.querySelector("#piano-success");

  // Calendario merende: solo i giorni di allenamento (lun/mer/ven) del mese selezionato,
  // perché le merende esistono solo in quei giorni. Serve alla coach per vedere a colpo
  // d'occhio quali L/M/V sono ancora senza merenda.
  const NOMI_G = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  function giorniLMV(anno, mese) {
    const out = [];
    const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
    for (let d = 1; d <= ultimo; d++) {
      const dow = new Date(Date.UTC(anno, mese - 1, d)).getUTCDay();
      if (dow === 1 || dow === 3 || dow === 5) {
        out.push({ iso: `${anno}-${String(mese).padStart(2, "0")}-${String(d).padStart(2, "0")}`, label: `${NOMI_G[dow]} ${d}` });
      }
    }
    return out;
  }
  function merendePerData() {
    const m = new Map();
    for (const row of merendeRows.querySelectorAll(".merenda-row")) {
      const iso = row.querySelector(".merenda-data").value;
      if (iso && !m.has(iso)) m.set(iso, row);
    }
    return m;
  }
  function disegnaCalendarioMerende() {
    const anno = Number(annoInput.value);
    const mese = Number(meseSel.value);
    const giorni = giorniLMV(anno, mese);
    const mappa = merendePerData();
    let assegnate = 0;

    calWrap.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(78px, 1fr)); gap:6px">
        ${giorni
          .map((g) => {
            const ha = mappa.has(g.iso);
            if (ha) assegnate++;
            return `
              <button type="button" class="merenda-cal-cell" data-iso="${g.iso}"
                style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; font-size:12px;
                       border:1px solid ${ha ? "var(--livello-1)" : "var(--border)"}; border-radius:8px; cursor:pointer;
                       background:${ha ? "color-mix(in srgb, var(--livello-1) 12%, transparent)" : "var(--surface-2)"};
                       color:var(--text); font-family:inherit">
                <span>${g.label}</span>
                <span style="width:8px; height:8px; border-radius:50%; background:${ha ? "var(--livello-1)" : "var(--mute)"}"></span>
              </button>`;
          })
          .join("")}
      </div>
      <p class="mono" style="color:var(--mute); font-size:11px; margin-top:6px">
        Pallino verde = merenda pronta. Tocca un giorno per aggiungerla o modificarla.
      </p>`;

    summaryMerende.textContent = `Merende del mese — ${assegnate} su ${giorni.length} giorni`;

    calWrap.querySelectorAll(".merenda-cal-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        const iso = cell.dataset.iso;
        let row = merendePerData().get(iso);
        if (!row) {
          row = rigaMerenda({ data: iso }, disegnaCalendarioMerende);
          merendeRows.appendChild(row);
          disegnaCalendarioMerende();
        }
        dettaglioMerende.open = true;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.style.outline = "2px solid var(--accent)";
        row.style.transition = "outline-color .3s";
        setTimeout(() => { row.style.outline = "2px solid transparent"; }, 1200);
      });
    });
  }

  // Vero solo quando le merende del mese corrente sono state caricate con successo (o è un
  // mese nuovo senza merende). Se il caricamento fallisce restiamo a false e il salvataggio
  // NON invia il campo `merende` → il worker lascia intatte quelle già salvate.
  let merendeSincronizzate = false;
  let primoCarica = true;
  const nota = el.querySelector("#merende-mese-nota");

  async function carica() {
    errorEl.hidden = true;
    successEl.hidden = true;
    for (const input of Object.values(campi)) input.value = "";
    merendeRows.innerHTML = "";
    merendeSincronizzate = false;

    let mese = Number(meseSel.value);
    let anno = Number(annoInput.value);
    try {
      const { mesi } = await api.get("/programma");

      // Al primo caricamento, se il mese di default (mese di calendario) è PRIMA dell'inizio
      // della stagione, spostati sul primo mese disponibile. Senza questo, ad agosto la
      // tendina parte da "Agosto" e il coach rischia di salvare contenuti/merende su un mese
      // che non compare nel Programma (fuori stagione) — è successo davvero.
      if (primoCarica && mesi.length) {
        const chiave = (m) => m.anno * 100 + m.mese;
        if (chiave({ mese, anno }) < chiave(mesi[0])) {
          mese = mesi[0].mese;
          anno = mesi[0].anno;
          meseSel.value = String(mese);
          annoInput.value = String(anno);
        }
      }
      primoCarica = false;
      if (nota) {
        nota.textContent =
          `Stai modificando ${MESI[mese - 1]} ${anno}. Le merende finiscono in questo mese; ` +
          `la data "Per il giorno" dice solo agli atleti quando vale, non le sposta.`;
      }

      const esistente = mesi.find((m) => m.mese === mese && m.anno === anno);
      if (!esistente) {
        merendeSincronizzate = true; // mese nuovo: nessuna merenda, form vuoto di proposito
      } else {
        const dettaglio = await api.get(`/programma/${esistente.id}`);
        for (const [chiave, input] of Object.entries(campi)) input.value = dettaglio[chiave] ?? "";
        for (const m of dettaglio.merende ?? []) merendeRows.appendChild(rigaMerenda(m, disegnaCalendarioMerende));
        merendeSincronizzate = true;
      }
    } catch {
      // Errore di rete: non sappiamo lo stato reale delle merende — non toccarle al salvataggio.
    }
    disegnaCalendarioMerende();
  }

  meseSel.addEventListener("change", carica);
  annoInput.addEventListener("change", carica);
  el.querySelector("#merenda-aggiungi").addEventListener("click", () => {
    merendeRows.appendChild(rigaMerenda({}, disegnaCalendarioMerende));
    disegnaCalendarioMerende();
  });

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
  const tipoSel = el.querySelector("#sfida-tipo");
  const criterioWrap = el.querySelector("#sfida-criterio-wrap");
  const criterioSel = el.querySelector("#sfida-criterio");
  const criterioN = el.querySelector("#sfida-criterio-n");
  const flashChk = el.querySelector("#sfida-flash");
  const meseSel = el.querySelector("#sfida-mese");
  const annoInput = el.querySelector("#sfida-anno");
  const datePrecise = el.querySelector("#sfida-date-precise");
  const inizioInput = el.querySelector("#sfida-inizio");
  const fineInput = el.querySelector("#sfida-fine");
  const elenco = el.querySelector("#sfide-elenco");

  let sfideCache = [];

  // ─── A. Elenco ───────────────────────────────────────────────────────────
  async function carica() {
    try {
      const { sfide } = await api.get("/sfide");
      sfideCache = sfide;
    } catch {
      elenco.innerHTML = `<p class="error-text">Impossibile caricare le sfide</p>`;
      return;
    }

    if (!sfideCache.length) {
      elenco.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Ancora nessuna sfida.</p>`;
    } else {
      const perMese = new Map();
      for (const s of sfideCache) {
        const k = (s.data_inizio || "").slice(0, 7);
        if (!perMese.has(k)) perMese.set(k, []);
        perMese.get(k).push(s);
      }
      const mesi = [...perMese.keys()].sort().reverse();
      elenco.innerHTML = mesi
        .map((k) => {
          const [anno, mm] = k.split("-");
          const righe = perMese
            .get(k)
            .sort((a, b) => (a.data_fine < b.data_fine ? 1 : -1))
            .map((s) => {
              const dd = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
              const flashBadge = s.flash
                ? ` <span class="mono" style="color:var(--sessione-b); font-size:10px">⚡ LAMPO</span>`
                : "";
              return `
                <div style="display:flex; align-items:flex-start; gap:8px; padding:8px 0; border-top:1px solid var(--border)">
                  <div style="flex:1; min-width:0">
                    <p style="font-size:14px; font-weight:600">${esc(s.titolo)}${flashBadge}</p>
                    <p class="mono" style="color:var(--mute); font-size:11px; margin-top:2px">
                      ${descriviSfida(s)} · ${dd(s.data_inizio)}–${dd(s.data_fine)} · ${s.numeroPartecipanti} partecipanti
                    </p>
                  </div>
                  <button type="button" class="link-btn sfida-del" data-id="${s.id}"
                    style="color:var(--livello-5); flex-shrink:0; text-decoration:none; font-size:16px">🗑</button>
                </div>`;
            })
            .join("");
          return `
            <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin:12px 0 0">
              ${(MESI[+mm - 1] || "").toUpperCase()} ${anno}
            </p>
            ${righe}`;
        })
        .join("");

      elenco.querySelectorAll(".sfida-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const s = sfideCache.find((x) => String(x.id) === btn.dataset.id);
          if (!s) return;
          const n = Number(s.numeroPartecipanti) || 0;
          const avviso = n > 0 ? ` Toglierai ~${n * 10} punti a ${n} atlet${n === 1 ? "a" : "i"}.` : "";
          if (!confirm(`Eliminare «${s.titolo}»?${avviso}`)) return;
          btn.disabled = true;
          try {
            await api.del(`/sfide/${s.id}`);
            await carica();
          } catch (err) {
            alert(err instanceof ApiError ? err.message : "Errore imprevisto");
            btn.disabled = false;
          }
        });
      });
    }
  }

  // ─── B. Form nuova sfida ─────────────────────────────────────────────────
  const aggiornaCriterio = () => {
    // `.field` ha display:flex, che vince su [hidden] -> uso style.display.
    criterioWrap.style.display = tipoSel.value === "traguardo" ? "" : "none";
    criterioN.hidden = !(tipoSel.value === "traguardo" && criterioSel.value === "presenze");
  };
  tipoSel.addEventListener("change", aggiornaCriterio);
  criterioSel.addEventListener("change", aggiornaCriterio);
  aggiornaCriterio();

  // Spuntando "sfida lampo" apro le date precise e propongo i prossimi 7 giorni.
  flashChk.addEventListener("change", () => {
    if (flashChk.checked) {
      datePrecise.open = true;
      if (!inizioInput.value && !fineInput.value) {
        const d = new Date();
        const fine = new Date(d.getTime() + 7 * 86400000);
        inizioInput.value = d.toISOString().slice(0, 10);
        fineInput.value = fine.toISOString().slice(0, 10);
      }
    }
  });

  // Periodo della sfida: date precise se sono state compilate entrambe (per le lampo),
  // altrimenti tutto il mese scelto nella tendina.
  function periodoSfida() {
    if (inizioInput.value && fineInput.value) {
      return { inizio: inizioInput.value, fine: fineInput.value };
    }
    return estremiMese(Number(annoInput.value), Number(meseSel.value));
  }

  el.querySelector("#sfida-crea").addEventListener("click", async (e) => {
    errorEl.hidden = true;
    successEl.hidden = true;

    const titolo = el.querySelector("#sfida-titolo").value.trim();
    const descrizione = el.querySelector("#sfida-descrizione").value.trim();
    const tipo = tipoSel.value;
    const { inizio: dataInizio, fine: dataFine } = periodoSfida();
    let criterio;
    if (tipo === "traguardo") {
      criterio = criterioSel.value === "presenze" ? `presenze:${Number(criterioN.value) || 1}` : criterioSel.value;
    }

    if (!titolo || !dataInizio || !dataFine) {
      errorEl.textContent = "Titolo e mese della sfida sono obbligatori";
      errorEl.hidden = false;
      return;
    }
    if (dataFine < dataInizio) {
      errorEl.textContent = "La data di fine è prima di quella di inizio";
      errorEl.hidden = false;
      return;
    }

    e.target.disabled = true;
    try {
      await api.post("/sfide", {
        titolo,
        descrizione: descrizione || undefined,
        tipo,
        criterio,
        flash: flashChk.checked ? 1 : 0,
        data_inizio: dataInizio,
        data_fine: dataFine,
      });
      successEl.hidden = false;
      el.querySelector("#sfida-titolo").value = "";
      el.querySelector("#sfida-descrizione").value = "";
      flashChk.checked = false;
      inizioInput.value = "";
      fineInput.value = "";
      datePrecise.open = false;
      await carica();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
      errorEl.hidden = false;
    } finally {
      e.target.disabled = false;
    }
  });

  carica();
}

function initSuddivisioni(el) {
  const meseSel = el.querySelector("#sudd-mese");
  const annoInput = el.querySelector("#sudd-anno");
  const body = el.querySelector("#sudd-body");
  const eur = (n) => (Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`);

  async function carica() {
    body.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Carico...</p>`;
    let d;
    try {
      d = await api.get(`/suddivisioni?anno=${annoInput.value}&mese=${meseSel.value}`);
    } catch {
      body.innerHTML = `<p class="error-text">Impossibile caricare</p>`;
      return;
    }

    // Righe raggruppate per abbonamento. Chi ha pagato è in evidenza (✓), gli altri in grigio.
    const gruppi = new Map();
    for (const r of d.righe) {
      const k = r.nomePiano ?? r.piano;
      if (!gruppi.has(k)) gruppi.set(k, []);
      gruppi.get(k).push(r);
    }
    const righe = d.righe.length
      ? [...gruppi.entries()]
          .map(([nomeP, rs]) => {
            const nPag = rs.filter((r) => r.pagato).length;
            const corpo = rs
              .map((r) => {
                const quote =
                  r.quotaCoach != null
                    ? `<span style="color:var(--livello-1)">${eur(r.quotaCoach)}</span> / <span style="color:var(--mute)">${eur(r.quotaPalestra)}</span>`
                    : `<span style="color:var(--livello-5)">da definire</span>`;
                return `
                  <div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-top:1px solid var(--border); opacity:${r.pagato ? 1 : 0.55}">
                    <span style="font-size:13px; min-width:0">${esc(r.nome)}
                      <span class="mono" style="color:var(--mute); font-size:11px"> · ${eur(r.prezzo)} ${r.pagato ? "✓ pagato" : "· non pagato"}</span>
                    </span>
                    <span class="mono" style="font-size:12px; white-space:nowrap">${quote}</span>
                  </div>`;
              })
              .join("");
            return `
              <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px; margin:14px 0 0">
                ${esc(nomeP).toUpperCase()} · ${nPag}/${rs.length} pagat${nPag === 1 ? "o" : "i"}
              </p>
              ${corpo}`;
          })
          .join("")
      : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun atleta con abbonamento questo mese.</p>`;

    const t = d.totali;
    const totali = `
      <div style="margin-top:10px; padding-top:10px; border-top:2px solid var(--border); display:flex; flex-wrap:wrap; gap:12px">
        <span class="mono" style="font-size:12px">A te: <strong style="color:var(--livello-1)">${eur(t.coach)}</strong></span>
        <span class="mono" style="font-size:12px">Palestra: <strong>${eur(t.palestra)}</strong></span>
        ${t.daDefinire ? `<span class="mono" style="font-size:12px; color:var(--livello-5)">Da definire: ${eur(t.daDefinire)}</span>` : ""}
      </div>
      <p class="mono" style="color:var(--mute); font-size:11px; margin-top:6px">Totali e PDF contano solo chi ha pagato.</p>
      <button type="button" class="btn" id="sudd-pdf" style="width:100%; margin-top:10px; background:var(--surface-2); color:var(--text)">Scarica PDF</button>`;

    const config = `
      <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border)">
        <p class="mono" style="color:var(--mute); font-size:11px; letter-spacing:1px">% CHE SPETTA A TE</p>
        ${PIANI.map((pl) => {
          const val = d.config[pl.key];
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:8px">
              <span class="mono" style="font-size:12px; color:${pl.colore}">${pl.nome} <span style="color:var(--mute)">· ${pl.prezzo} €</span></span>
              <span style="display:flex; align-items:center; gap:4px">
                <input type="number" class="sudd-pct" data-piano="${pl.key}" min="0" max="100" value="${val ?? ""}" placeholder="—"
                  style="width:64px; text-align:right; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:6px 8px; color:var(--text); font-family:inherit" />
                <span class="mono" style="color:var(--mute); font-size:12px">%</span>
              </span>
            </div>`;
        }).join("")}
      </div>`;

    body.innerHTML = righe + totali + config;

    const pdfBtn = body.querySelector("#sudd-pdf");
    if (pdfBtn) {
      pdfBtn.addEventListener("click", async () => {
        pdfBtn.disabled = true;
        pdfBtn.textContent = "Preparo il PDF…";
        try {
          const { scaricaSuddivisioniPdf } = await import("../pdf/suddivisioni-pdf.js");
          await scaricaSuddivisioniPdf(d, MESI);
        } catch {
          alert("Non sono riuscito a generare il PDF.");
        } finally {
          pdfBtn.disabled = false;
          pdfBtn.textContent = "Scarica PDF";
        }
      });
    }

    body.querySelectorAll(".sudd-pct").forEach((inp) => {
      inp.addEventListener("change", async () => {
        const v = inp.value.trim();
        if (v === "" || Number(v) < 0 || Number(v) > 100) return;
        inp.disabled = true;
        try {
          await api.post("/suddivisioni/config", { piano: inp.dataset.piano, quotaCoachPct: Number(v) });
          await carica();
        } catch {
          inp.disabled = false;
        }
      });
    });
  }

  meseSel.addEventListener("change", carica);
  annoInput.addEventListener("change", carica);
  carica();
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
