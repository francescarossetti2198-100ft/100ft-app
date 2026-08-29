import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError, mediaUrl } from "../api.js";

const TIPO_LABEL = {
  presenza: "Sfida di gruppo",
  foto: "Sfida foto",
  valore_manuale: "Sfida personale",
};

const PERIODI = [
  { valore: "settimana", label: "Settimana" },
  { valore: "mese", label: "Mese" },
  { valore: "totale", label: "Totale" },
];

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// Un colore d'accento per ogni mese — così ogni scheda ha una sua identità "editoriale"
// (un colore alla volta, mai tutti insieme). Presi SOLO dalla palette di brand già in
// style.css (livelli + sessioni + accent), niente tinte nuove; scelti per stagione e in
// modo che due mesi vicini non si somiglino.
const MESE_ACCENTO = {
  1: "#2D7DD2",  // Gennaio  — blu (livello 2)
  2: "#4B3FA0",  // Febbraio — indaco (sessione C)
  3: "#8BC53F",  // Marzo    — verde (livello 1)
  4: "#E83E8C",  // Aprile   — magenta (sessione extra)
  5: "#8BC53F",  // Maggio   — verde (livello 1)
  6: "#F4B740",  // Giugno   — oro (livello 3)
  7: "#FF7A29",  // Luglio   — arancio (livello 4 / sessione A)
  8: "#E63946",  // Agosto   — rosso (livello 5)
  9: "#8B5CF6",  // Settembre — viola accent (nuova stagione)
  10: "#FF7A29", // Ottobre  — arancio (autunno)
  11: "#4B3FA0", // Novembre — indaco (sessione C)
  12: "#A85CFF", // Dicembre — viola (livello 6)
};

function meseNome(key) {
  return MESI[Number(key.split("-")[1]) - 1].toUpperCase();
}

function meseAccento(key) {
  return MESE_ACCENTO[Number(key.split("-")[1])] ?? "var(--accent)";
}

// Foto profilo se c'è, altrimenti un cerchio con l'iniziale — così la classifica resta
// leggibile anche per chi non ha ancora caricato una foto.
function avatarHtml(a) {
  const nome = a.nickname || a.nome || "?";
  if (a.fotoUrl) {
    return `<img src="${mediaUrl(a.fotoUrl)}" alt="" style="width:22px; height:22px; border-radius:50%; object-fit:cover" />`;
  }
  return `<span style="width:22px; height:22px; border-radius:50%; background:var(--surface-2); display:inline-flex; align-items:center; justify-content:center; font-size:11px; color:var(--mute)">${nome[0].toUpperCase()}</span>`;
}

// Movimento rispetto al periodo precedente: freccia verde su se sale in classifica,
// rossa giù se scende. Niente freccia se è fermo o non era ancora in classifica.
// Va messa subito prima dei punti ("▲ 90 PT").
function variazioneHtml(v) {
  if (v == null || v === 0) return "";
  const su = v > 0;
  const colore = su ? "var(--livello-1)" : "var(--livello-5)";
  return `<span style="color:${colore}; margin-right:5px" title="${su ? "+" : ""}${v} posizioni">${su ? "▲" : "▼"}</span>`;
}

// TODO: classifica Season e Improvement (basata sul miglioramento personale, brief sezione 10).
export function renderSfide(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <style>
      /* Scheda mese: dark/editoriale, un accento per mese (--mese-accento) su titolo e
         fondo, resto invariato. Palette solo dai token di brand. */
      #sfide-blocco {
        position: relative;
        overflow: hidden;
        background-color: var(--surface);
        /* Alone tenue nel colore del mese — se color-mix non è supportato resta solo --surface. */
        background-image: radial-gradient(130% 70% at 50% 0%,
          color-mix(in srgb, var(--mese-accento, var(--accent)) 11%, transparent), transparent 72%);
      }
      #sfide-blocco .mese-viewport { overflow: hidden; touch-action: pan-y; }
      #sfide-blocco .mese-track { will-change: transform, opacity; }
      #sfide-blocco .mese-head { text-align: center; }
      #sfide-blocco .mese-kicker {
        font-size: 11px; letter-spacing: 2px; color: var(--mute);
        text-transform: uppercase; margin: 0;
      }
      #sfide-blocco .mese-title {
        font-family: var(--font-ui); font-weight: 800; font-size: 30px; line-height: 1;
        letter-spacing: -0.5px; text-transform: uppercase; margin: 4px 0 0;
        color: var(--mese-accento, var(--accent));
      }
      #sfide-blocco .mese-focus {
        font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
        color: var(--mute); margin: 6px 0 0;
      }
      #sfide-blocco .mese-focus strong { color: var(--mese-accento, var(--accent)); font-weight: 700; }
      /* Barra di avanzamento: una milestone per ogni sfida del mese, piena fino alle
         completate. Sotto il titolo/focus, nell'accento del mese. */
      #sfide-blocco .mese-progress { display: flex; gap: 4px; margin: 12px 0 0; }
      #sfide-blocco .mese-progress span {
        flex: 1; height: 6px; border-radius: 3px; background: var(--surface-2);
      }
      #sfide-blocco .mese-progress span.on { background: var(--mese-accento, var(--accent)); }
      #sfide-blocco .sfida-item { padding: 14px 0; border-top: 1px solid var(--border); }
      #sfide-blocco .sfida-item:first-of-type { border-top: none; padding-top: 2px; }
      /* Sfida completata: sembra archiviata e riuscita, senza stravolgere lo stile. */
      #sfide-blocco .sfida-item.done { opacity: 0.5; }
      #sfide-blocco .mese-arrow {
        background: none; border: none; color: var(--mute); font-size: 22px;
        line-height: 1; padding: 4px 10px; cursor: pointer; font-family: inherit;
      }
    </style>
    <h1>Sfide</h1>
    <div id="daily-drop-card" class="card" style="margin-bottom:16px"></div>
    <div id="classifica"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    <div id="sfide-list" style="margin-top:16px"></div>
  `;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());

  loadDailyDrop(el);
  loadClassifica(el, "mese");
  loadSfide(el);
}

async function loadDailyDrop(el) {
  const card = el.querySelector("#daily-drop-card");
  try {
    const { previsto, attivo, risposta, numeroRisposte } = await api.get("/daily-drop/oggi");

    // Occasionale in occasione dei giorni di allenamento — quando non è previsto, niente card.
    if (!previsto) {
      card.remove();
      return;
    }

    if (risposta) {
      card.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:12px">💧 DAILY DROP</p>
        <p style="margin-top:6px">Hai già risposto oggi ✓</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${numeroRisposte} atleti hanno già risposto</p>
      `;
      return;
    }

    // Non riveliamo mai l'orario esatto prima che scatti — si perderebbe l'effetto sorpresa.
    if (!attivo) {
      card.innerHTML = `
        <p class="mono" style="color:var(--mute); font-size:12px">💧 DAILY DROP</p>
        <p class="mono" style="color:var(--mute); margin-top:6px">Non ancora arrivato oggi — tieni d'occhio l'app.</p>
      `;
      return;
    }

    card.innerHTML = `
      <p class="mono" style="color:var(--mute); font-size:12px">💧 DAILY DROP</p>
      <p style="margin-top:6px">Una foto al volo, ovunque tu sia in questo momento.</p>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${numeroRisposte} atleti hanno già risposto</p>
      <input id="dd-foto" type="file" accept="image/*" capture="environment"
             style="margin-top:10px; width:100%; color:var(--text)" />
      <p class="error-text" id="dd-error" hidden style="margin-top:6px"></p>
      <button class="btn" id="dd-submit" style="width:100%; margin-top:10px">Rispondi</button>
    `;

    card.querySelector("#dd-submit").addEventListener("click", async (e) => {
      const errorEl = card.querySelector("#dd-error");
      const input = card.querySelector("#dd-foto");
      errorEl.hidden = true;

      if (!input.files[0]) {
        errorEl.textContent = "Scegli o scatta una foto";
        errorEl.hidden = false;
        return;
      }

      e.target.disabled = true;
      const formData = new FormData();
      formData.append("foto", input.files[0]);
      try {
        await api.postForm("/daily-drop", formData);
        loadDailyDrop(el);
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
        e.target.disabled = false;
      }
    });
  } catch {
    card.remove();
  }
}

async function loadClassifica(el, periodo) {
  const box = el.querySelector("#classifica");
  try {
    const { classifica } = await api.get(`/sfide/classifica?periodo=${periodo}`);

    const tabsHtml = `
      <div style="display:flex; gap:6px; margin-bottom:10px">
        ${PERIODI.map((p) => {
          const attivo = p.valore === periodo;
          return `
            <button type="button" class="periodo-btn" data-periodo="${p.valore}"
              style="flex:1; padding:6px 0; border-radius:6px; border:none; font-size:12px; cursor:pointer;
                     background:${attivo ? "var(--accent)" : "var(--surface-2)"};
                     color:${attivo ? "#fff" : "var(--text)"}; font-weight:${attivo ? "600" : "400"}">
              ${p.label}
            </button>
          `;
        }).join("")}
      </div>
    `;

    box.innerHTML = `
      <div class="card">
        ${tabsHtml}
        <div style="display:flex; flex-direction:column; gap:8px">
          ${
            classifica.length
              ? classifica
                  .map(
                    (a, i) => `
                      <div style="display:flex; align-items:center; justify-content:space-between">
                        <span style="display:flex; align-items:center; gap:8px">
                          ${a.posizione ?? i + 1}. ${avatarHtml(a)} ${a.nickname || a.nome}
                        </span>
                        <strong>${variazioneHtml(a.variazione)}${a.punti} PT</strong>
                      </div>
                    `
                  )
                  .join("")
              : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun punto ancora in questo periodo.</p>`
          }
        </div>
      </div>
    `;

    box.querySelectorAll(".periodo-btn").forEach((btn) => {
      btn.addEventListener("click", () => loadClassifica(el, btn.dataset.periodo));
    });
  } catch {
    box.remove();
  }
}

// Una singola sfida come riga dentro la card del mese. Le completate restano visibili
// ma "archiviate" (classe .done -> opacità ridotta + esito riuscito).
function sfidaItemHtml(s, oggi) {
  const scaduta = s.data_fine < oggi;
  const done = !!s.partecipato;
  const azione = done
    ? `<p class="mono" style="color:var(--livello-1); font-size:13px; margin-top:10px">✓ Completata</p>`
    : scaduta
      ? `<button class="btn" style="width:100%; margin-top:10px" disabled>Sfida terminata</button>`
      : s.tipo === "foto"
        ? `
          <input class="foto-input" type="file" accept="image/*" capture="environment"
                 style="margin-top:10px; width:100%; color:var(--text)" />
          <p class="error-text foto-error" hidden style="margin-top:6px"></p>
          <button class="btn partecipa-btn" style="width:100%; margin-top:10px">Carica foto e partecipa</button>
        `
        : `<button class="btn partecipa-btn" style="width:100%; margin-top:10px">Partecipa</button>`;

  return `
    <div class="sfida-item${done ? " done" : ""}" data-id="${s.id}" data-tipo="${s.tipo}">
      <p class="mono" style="color:var(--mute); font-size:11px">${TIPO_LABEL[s.tipo] ?? s.tipo}${done ? " · ARCHIVIATA" : ""}</p>
      <p style="font-weight:600; margin-top:2px">${s.titolo}</p>
      ${s.descrizione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">${s.descrizione}</p>` : ""}
      <p class="mono" style="color:var(--accent); font-size:13px; margin-top:8px">+${s.punti} PT · ${s.numeroPartecipanti} partecipanti</p>
      ${azione}
    </div>
  `;
}

function attachPartecipa(container, el, onDone) {
  container.querySelectorAll(".partecipa-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const cardEl = e.target.closest("[data-id]");
      const id = cardEl.dataset.id;
      const errorEl = cardEl.querySelector(".foto-error");

      const formData = new FormData();
      if (cardEl.dataset.tipo === "foto") {
        const input = cardEl.querySelector(".foto-input");
        if (!input.files[0]) {
          errorEl.textContent = "Scegli o scatta una foto per convalidare la sfida";
          errorEl.hidden = false;
          return;
        }
        formData.append("foto", input.files[0]);
      }

      e.target.disabled = true;
      try {
        await api.postForm(`/sfide/${id}/partecipa`, formData);
        loadClassifica(el, "mese");
        onDone();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
          errorEl.hidden = false;
        }
        e.target.disabled = false;
      }
    });
  });
}

// Blocco Sfide: una card che raccoglie le sfide del mese (completate e non). Swipe
// left/right — o le frecce — per passare al mese precedente/successivo.
async function loadSfide(el, meseVoluto) {
  const list = el.querySelector("#sfide-list");

  let sfide;
  try {
    ({ sfide } = await api.get("/sfide"));
  } catch (err) {
    list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
    return;
  }

  // Focus tematico del mese (l'unica anticipazione concessa dal brief) — lo mostriamo come
  // sottotitolo della scheda. Se l'endpoint non risponde, la scheda funziona lo stesso.
  const focusPerMese = new Map();
  try {
    const { mesi: programma } = await api.get("/programma");
    for (const m of programma ?? []) {
      if (m.focusTema) {
        focusPerMese.set(`${m.anno}-${String(m.mese).padStart(2, "0")}`, m.focusTema);
      }
    }
  } catch {
    /* nessun focus: la scheda mostra solo il mese */
  }

  const oggi = new Date().toISOString().slice(0, 10);
  const meseCorrente = oggi.slice(0, 7);

  // Raggruppa per mese di inizio; il mese corrente è sempre presente anche se vuoto.
  const perMese = new Map();
  for (const s of sfide) {
    const key = (s.data_inizio || meseCorrente).slice(0, 7);
    if (!perMese.has(key)) perMese.set(key, []);
    perMese.get(key).push(s);
  }
  if (!perMese.has(meseCorrente)) perMese.set(meseCorrente, []);

  const mesi = [...perMese.keys()].sort();
  let idx = mesi.indexOf(meseVoluto && perMese.has(meseVoluto) ? meseVoluto : meseCorrente);
  if (idx < 0) idx = Math.max(0, mesi.length - 1);

  list.innerHTML = `
    <div id="sfide-blocco" class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:14px">
        <button type="button" class="mese-arrow" data-dir="-1" aria-label="Mese precedente">‹</button>
        <div class="mese-head" style="flex:1">
          <p class="mono mese-kicker">Sfide del mese</p>
          <h2 class="mese-title"></h2>
          <p class="mono mese-focus" hidden></p>
          <div class="mese-progress" hidden></div>
        </div>
        <button type="button" class="mese-arrow" data-dir="1" aria-label="Mese successivo">›</button>
      </div>
      <div class="mese-viewport">
        <div class="mese-track"></div>
      </div>
      <div class="mese-dots" style="display:flex; gap:5px; justify-content:center; margin-top:14px"></div>
    </div>
  `;

  const blocco = list.querySelector("#sfide-blocco");
  const titleEl = blocco.querySelector(".mese-title");
  const kickerEl = blocco.querySelector(".mese-kicker");
  const focusEl = blocco.querySelector(".mese-focus");
  const progressEl = blocco.querySelector(".mese-progress");
  const viewport = blocco.querySelector(".mese-viewport");
  const track = blocco.querySelector(".mese-track");
  const dotsBox = blocco.querySelector(".mese-dots");

  const disegnaMese = () => {
    const key = mesi[idx];
    const items = [...perMese.get(key)].sort((a, b) => (a.data_fine < b.data_fine ? 1 : -1));
    const completate = items.filter((s) => s.partecipato).length;
    const accento = meseAccento(key);

    blocco.style.setProperty("--mese-accento", accento);
    kickerEl.textContent = `Sfide · ${key.split("-")[0]}`;
    titleEl.textContent = meseNome(key);
    const focus = focusPerMese.get(key);
    focusEl.hidden = !focus;
    if (focus) focusEl.innerHTML = `Focus del mese — <strong>${focus}</strong>`;

    // Una milestone per sfida del mese, piena fino alle completate.
    progressEl.hidden = items.length === 0;
    progressEl.innerHTML = items
      .map((_, i) => `<span class="${i < completate ? "on" : ""}"></span>`)
      .join("");

    track.innerHTML = items.length
      ? `<p class="mono" style="color:var(--mute); font-size:11px; margin-bottom:6px">` +
          `${items.length} sfid${items.length === 1 ? "a" : "e"}` +
          `${completate ? ` · ${completate} completat${completate === 1 ? "a" : "e"}` : ""}</p>` +
        items.map((s) => sfidaItemHtml(s, oggi)).join("")
      : `<p class="mono" style="color:var(--mute); font-size:13px; padding:8px 0">Nessuna sfida per questo mese.</p>`;

    dotsBox.innerHTML = mesi
      .map(
        (_, i) =>
          `<span style="width:6px; height:6px; border-radius:50%; background:${
            i === idx ? accento : "var(--surface-2)"
          }"></span>`
      )
      .join("");

    blocco.querySelectorAll(".mese-arrow").forEach((b) => {
      const d = Number(b.dataset.dir);
      const bordo = (d < 0 && idx === 0) || (d > 0 && idx === mesi.length - 1);
      b.style.opacity = bordo ? "0.25" : "1";
    });

    attachPartecipa(track, el, () => loadSfide(el, mesi[idx]));
  };

  const vaiA = (nuovoIdx, dir) => {
    nuovoIdx = Math.max(0, Math.min(mesi.length - 1, nuovoIdx));
    if (nuovoIdx === idx) {
      track.style.transition = "transform .18s ease";
      track.style.transform = "";
      return;
    }
    const uscita = dir > 0 ? -1 : 1;
    track.style.transition = "transform .16s ease, opacity .16s ease";
    track.style.transform = `translateX(${uscita * 40}px)`;
    track.style.opacity = "0";
    setTimeout(() => {
      idx = nuovoIdx;
      disegnaMese();
      track.style.transition = "none";
      track.style.transform = `translateX(${-uscita * 40}px)`;
      requestAnimationFrame(() => {
        track.style.transition = "transform .16s ease, opacity .16s ease";
        track.style.transform = "";
        track.style.opacity = "1";
      });
    }, 160);
  };

  blocco.querySelectorAll(".mese-arrow").forEach((b) =>
    b.addEventListener("click", () => vaiA(idx + Number(b.dataset.dir), Number(b.dataset.dir)))
  );

  // Swipe orizzontale — la UX chiave richiesta.
  let x0 = null;
  let y0 = null;
  let trascina = false;
  viewport.addEventListener(
    "touchstart",
    (e) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      trascina = false;
      track.style.transition = "none";
    },
    { passive: true }
  );
  viewport.addEventListener(
    "touchmove",
    (e) => {
      if (x0 == null) return;
      const dx = e.touches[0].clientX - x0;
      const dy = e.touches[0].clientY - y0;
      if (!trascina && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) trascina = true;
      if (trascina) {
        e.preventDefault();
        const resist =
          (idx === 0 && dx > 0) || (idx === mesi.length - 1 && dx < 0) ? 0.3 : 1;
        track.style.transform = `translateX(${dx * resist}px)`;
      }
    },
    { passive: false }
  );
  viewport.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    track.style.transition = "transform .18s ease, opacity .18s ease";
    if (trascina && Math.abs(dx) > 60) {
      vaiA(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    } else {
      track.style.transform = "";
    }
    x0 = null;
    y0 = null;
    trascina = false;
  });

  disegnaMese();
}
