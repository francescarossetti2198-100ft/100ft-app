import { renderTabbar } from "../components/tabbar.js";
import { api, ApiError, mediaUrl } from "../api.js";
import { getUser } from "../auth.js";
import { collageHtml, scaricaCollageHtml, attachCollage, nomeMissione } from "../collage.js";

const TIPO_LABEL = {
  presenza: "Sfida di gruppo",
  foto: "Sfida foto",
  valore_manuale: "Sfida personale",
  traguardo: "Traguardo",
};

const CRITERIO_TESTO = {
  profilo_completo: "Si completa da sola quando compili «Il tuo profilo» e «I tuoi dati».",
  obiettivi_completi: "Si completa da sola quando compili i tuoi obiettivi personali.",
  daily_drop: "Si completa da sola dopo il tuo primo daily drop.",
  settimana_completa: "Si completa da sola quando ti alleni lunedì, mercoledì e venerdì della stessa settimana.",
};
function criterioTesto(criterio) {
  if (!criterio) return "";
  const m = String(criterio).match(/^presenze:(\d+)$/);
  if (m) return `Si completa da sola quando raggiungi ${m[1]} presenze confermate.`;
  const dd = String(criterio).match(/^daily_drop:(\d+)$/);
  if (dd) return `Si completa da sola quando rispondi a ${dd[1]} daily drop in questo mese.`;
  return CRITERIO_TESTO[criterio] ?? "";
}

const PERIODI = [
  { valore: "settimana", label: "Settimana" },
  { valore: "mese", label: "Mese" },
  { valore: "totale", label: "Totale" },
];

// <input type=file> camuffato da bottone: il testo nativo ("Scegli file") non si può
// cambiare, quindi l'input è nascosto dentro una <label> che fa da bottone "Scatta la
// foto". Scelto un file, l'etichetta lo conferma. `cls` = classe sull'input per il resto
// del codice (`.foto-input`, `.dd-foto`).
// `galleria: true` → niente `capture`, così il telefono lascia scegliere tra fotocamera e
// galleria (per le sfide foto). Senza, forza la fotocamera (Daily Drop: "foto al volo").
function fotoInputHtml(cls, { galleria = false } = {}) {
  const label = galleria ? "📷 Scatta o scegli una foto" : "📷 Scatta la foto";
  return `
    <label class="foto-btn" style="position:relative; width:100%; margin-top:10px; display:flex;
           align-items:center; justify-content:center; gap:8px; padding:12px 20px; border-radius:10px;
           background:var(--surface-2); color:var(--text); font-weight:600; font-size:15px; cursor:pointer">
      <span class="foto-btn-txt" data-label="${label}">${label}</span>
      <input class="${cls}" type="file" accept="image/*"${galleria ? "" : ' capture="environment"'}
             style="position:absolute; width:1px; height:1px; opacity:0" />
    </label>
  `;
}

function attachFotoInput(scope) {
  scope.querySelectorAll(".foto-btn input[type=file]").forEach((input) => {
    input.addEventListener("change", () => {
      const txt = input.closest(".foto-btn")?.querySelector(".foto-btn-txt");
      if (txt) txt.textContent = input.files[0] ? "✓ Foto pronta — tocca per cambiare" : txt.dataset.label;
    });
  });
}

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
  const segnaposto = (display) =>
    `<span style="display:${display}; width:22px; height:22px; border-radius:50%; background:var(--surface-2); align-items:center; justify-content:center; font-size:11px; color:var(--mute)">${nome[0].toUpperCase()}</span>`;
  if (a.fotoUrl) {
    // Foto orfana su R2 → l'<img> fallisce: ripiega sul cerchio con l'iniziale.
    return `<img src="${mediaUrl(a.fotoUrl)}" alt=""
       onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"
       style="width:22px; height:22px; border-radius:50%; object-fit:cover" />${segnaposto("none")}`;
  }
  return segnaposto("inline-flex");
}

// Ultimo spostamento in classifica (a ogni sorpasso di punti): freccia verde su se hai
// guadagnato posizioni, rossa giù se le hai perse — rispetto alla posizione precedente,
// non a un periodo passato. Resta finché la posizione non cambia di nuovo. Niente freccia
// se sei fermo, a 0 punti o non hai ancora avuto un cambio. Va subito prima dei punti.
function variazioneHtml(v) {
  if (v == null || v === 0) return "";
  const su = v > 0;
  const colore = su ? "var(--livello-1)" : "var(--livello-5)";
  return `<span style="color:${colore}; margin-right:5px" title="${su ? "+" : ""}${v} posizioni dall'ultimo sorpasso">${su ? "▲" : "▼"}</span>`;
}

// TODO: classifica Season e Improvement (basata sul miglioramento personale, brief sezione 10).
export function renderSfide(appEl) {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `<h1>Sfide</h1><div id="sfide-vista"></div>`;
  appEl.appendChild(el);
  appEl.appendChild(renderTabbar());
  montaSfide(el.querySelector("#sfide-vista"));
}

// Vista Sfide (Daily Drop + classifica + carosello dei mesi) dentro `container`, già nel
// DOM. Riusata dalla pagina Sfide dell'atleta e da quella della dashboard coach (dove il
// Daily Drop non ha senso: `conDailyDrop:false`). Le sfide completate/da fare le gestisce
// `sfidaItemHtml`, che già distingue il ruolo coach ("Come coach non partecipi").
export function montaSfide(container, { conDailyDrop = true } = {}) {
  sfideAperte = false;
  container.innerHTML = `
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
        font-family: var(--font-ui); font-weight: 700;
        font-size: 12px; letter-spacing: 1.5px; color: var(--text);
        text-transform: uppercase; margin: 0;
      }
      #sfide-blocco .mese-title {
        font-family: var(--font-ui); font-weight: 800; font-size: 30px; line-height: 1;
        letter-spacing: -0.5px; text-transform: uppercase; margin: 4px 0 0;
        color: var(--mese-accento, var(--accent));
      }
      /* Barra di avanzamento: una milestone per ogni sfida del mese, piena fino alle
         completate. A fine barra la medaglia del mese: da lineata (in bianco/nero) a
         colorata quando tutte le sfide del mese sono completate. */
      #sfide-blocco .mese-progress { display: flex; align-items: center; gap: 4px; margin: 12px 0 0; }
      #sfide-blocco .mese-progress span { flex: 1; height: 6px; border-radius: 3px; background: color-mix(in srgb, var(--text) 16%, transparent); }
      #sfide-blocco .mese-progress span.on { background: var(--mese-accento, var(--accent)); }
      #sfide-blocco .mese-medaglia {
        flex: 0 0 auto; width: 26px; height: 26px; margin-left: 8px; display: block;
        object-fit: contain; opacity: 0.92; transition: opacity .2s ease, filter .2s ease;
      }
      #sfide-blocco .mese-medaglia.on {
        opacity: 1;
        filter: drop-shadow(0 0 6px color-mix(in srgb, var(--mese-accento, var(--accent)) 55%, transparent));
      }
      /* Box "Sfide extra": una cosa a parte rispetto alle sfide del mese — bordo tratteggiato
         e fondo pieno nel colore del mese, titolo con il "+" in un bollino, punti a pillola. */
      #sfide-extra {
        margin-top: 14px;
        background: color-mix(in srgb, var(--mese-accento, var(--accent)) 7%, var(--surface));
        border: 2px dashed color-mix(in srgb, var(--mese-accento, var(--accent)) 55%, transparent);
      }
      #sfide-extra .extra-head { display: flex; align-items: center; gap: 10px; }
      #sfide-extra .extra-plus {
        flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: var(--mese-accento, var(--accent)); color: #fff;
        font-family: var(--font-ui); font-weight: 800; font-size: 20px; line-height: 1;
      }
      #sfide-extra .extra-title {
        font-family: var(--font-ui); font-weight: 800; font-size: 24px; line-height: 1;
        letter-spacing: -0.3px; text-transform: uppercase; margin: 0;
        color: var(--mese-accento, var(--accent));
      }
      #sfide-extra .extra-sub { color: var(--mute); font-size: 12px; line-height: 1.5; margin-top: 8px; }
      #sfide-extra .extra-item {
        margin-top: 12px; padding: 12px 14px; border-radius: 10px; background: var(--surface);
        border-left: 3px solid var(--mese-accento, var(--accent));
      }
      #sfide-extra .extra-pill {
        display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px;
        background: var(--mese-accento, var(--accent)); color: #fff; font-weight: 700; font-size: 12px;
      }
      /* Bottone "a tendina" (classifica e card del mese). */
      .tendina-btn {
        display: block; width: 100%; margin-top: 12px; padding: 10px 12px; border-radius: 10px;
        background: none; border: 1px solid var(--border); color: var(--text); cursor: pointer;
        font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.5px;
      }
      #sfide-blocco .tendina-btn { color: var(--mese-accento, var(--accent)); }
      #sfide-blocco .sfida-item { padding: 14px 0; border-top: 1px solid var(--border); }
      #sfide-blocco .sfida-item:first-of-type { border-top: none; padding-top: 2px; }
      /* La tendina a tappe è un <details>: il primo <div> dopo di lei non è il primo della lista. */
      #sfide-blocco details.sfida-item ~ div.sfida-item { border-top: 1px solid var(--border); padding-top: 14px; }
      /* Sfida completata: sembra archiviata e riuscita, senza stravolgere lo stile. */
      #sfide-blocco .sfida-item.done { opacity: 0.5; }
      #sfide-blocco .sfida-tappe > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 12px; }
      #sfide-blocco .sfida-tappe > summary::-webkit-details-marker { display: none; }
      #sfide-blocco .sfida-tappe > summary::after {
        content: "\\25BE"; color: var(--mese-accento, var(--accent)); font-size: 14px; transition: transform 0.15s ease;
      }
      #sfide-blocco .sfida-tappe[open] > summary::after { transform: rotate(180deg); }
      #sfide-blocco .missione-dettaglio > summary { list-style: none; cursor: pointer; }
      #sfide-blocco .missione-dettaglio > summary::-webkit-details-marker { display: none; }
      #sfide-blocco .missione-dettaglio > summary::after {
        content: " \\24D8"; color: var(--mute); font-size: 13px;
      }
      #sfide-blocco .missione-dettaglio[open] > summary::after { color: var(--mese-accento, var(--accent)); }
      #sfide-blocco .mese-arrow {
        background: none; border: none; color: var(--mute); font-size: 22px;
        line-height: 1; padding: 4px 10px; cursor: pointer; font-family: inherit;
      }
    </style>
    ${conDailyDrop ? `<div id="daily-drop-card" class="card" style="margin-bottom:16px"></div>` : ""}
    <div id="classifica"><p class="mono" style="color:var(--mute)">Carico...</p></div>
    <div id="albo-oro" style="margin-top:12px"></div>
    <div id="sfide-list" style="margin-top:16px"></div>
  `;

  if (conDailyDrop) loadDailyDrop(container);
  loadClassifica(container, "mese");
  loadAlboOro(container);
  loadSfide(container);
}

async function loadDailyDrop(el) {
  const card = el.querySelector("#daily-drop-card");
  try {
    const { previsto, attivo, scaduto, risposta, numeroRisposte, speciale } = await api.get("/daily-drop/oggi");
    // Daily Drop speciale (Natale, Capodanno): titolo e invito suoi.
    const titoloDD = speciale?.titolo ?? "💧 DAILY DROP";

    // Occasionale in occasione dei giorni di allenamento — quando non è previsto, niente card.
    if (!previsto) {
      card.remove();
      return;
    }

    if (risposta) {
      card.innerHTML = `
        <p class="kicker">${titoloDD}</p>
        <p style="margin-top:6px">Hai già risposto oggi ✓</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${numeroRisposte} atleti hanno già risposto</p>
      `;
      return;
    }

    // Finestra di risposta chiusa (sono passati i minuti previsti dalla notifica): niente
    // più modulo, la possibilità di rispondere è finita per oggi.
    if (scaduto) {
      card.innerHTML = `
        <p class="kicker">${titoloDD}</p>
        <p class="mono" style="color:var(--mute); margin-top:6px">Il momento per oggi è passato ⏱</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${numeroRisposte} atleti hanno risposto in tempo</p>
      `;
      return;
    }

    // Non riveliamo mai l'orario esatto prima che scatti — si perderebbe l'effetto sorpresa.
    if (!attivo) {
      card.innerHTML = `
        <p class="kicker">${titoloDD}</p>
        <p class="mono" style="color:var(--mute); margin-top:6px">Non ancora arrivato oggi — tieni d'occhio l'app.</p>
      `;
      return;
    }

    card.innerHTML = `
      <p class="kicker">${titoloDD}</p>
      <p style="margin-top:6px">${speciale?.invito ?? "Una foto al volo, ovunque tu sia in questo momento."}</p>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">${numeroRisposte} atleti hanno già risposto</p>
      ${fotoInputHtml("dd-foto")}
      <textarea id="dd-testo" rows="2" maxlength="280" placeholder="Scrivi qualcosa da mettere nel Feed (facoltativo)"
        style="width:100%; margin-top:10px; padding:10px 12px; border-radius:10px; border:1px solid var(--border);
               background:var(--surface-2); color:var(--text); font:inherit; font-size:14px; resize:vertical"></textarea>
      <p class="error-text" id="dd-error" hidden style="margin-top:6px"></p>
      <button class="btn" id="dd-submit" style="width:100%; margin-top:10px">Rispondi</button>
    `;

    attachFotoInput(card);

    card.querySelector("#dd-submit").addEventListener("click", async (e) => {
      const errorEl = card.querySelector("#dd-error");
      const input = card.querySelector(".dd-foto");
      errorEl.hidden = true;

      if (!input.files[0]) {
        errorEl.textContent = "Scegli o scatta una foto";
        errorEl.hidden = false;
        return;
      }

      e.target.disabled = true;
      const formData = new FormData();
      formData.append("foto", input.files[0]);
      formData.append("testo", card.querySelector("#dd-testo").value.trim());
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

// Classifica a tendina: si vedono i primi 5, gli altri col bottone sotto.
const PRIMI_IN_CLASSIFICA = 5;

async function loadClassifica(el, periodo) {
  const box = el.querySelector("#classifica");
  try {
    const { classifica, nascosta, svelaIl } = await api.get(`/sfide/classifica?periodo=${periodo}`);

    // Ultima settimana del mese: classifica segreta fino all'Atleta del mese.
    if (nascosta) {
      const [, m, g] = svelaIl.slice(0, 10).split("-").map(Number);
      box.innerHTML = `
        <div class="card" style="text-align:center; padding:22px 16px">
          <p style="font-size:34px; line-height:1">🤫</p>
          <p style="font-weight:600; margin-top:8px">Classifica segreta</p>
          <p class="mono" style="color:var(--mute); font-size:13px; margin-top:6px; line-height:1.5">
            Nell'ultima settimana del mese la classifica si nasconde: dai il massimo fino all'ultimo!<br>
            Si svela il ${g === 1 ? "1°" : g} ${MESI[m - 1].toLowerCase()} alle ${svelaIl.slice(11, 16)} con l'Atleta del mese 🏆
          </p>
        </div>`;
      return;
    }

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
                      <div class="classifica-riga" style="display:${
                        i >= PRIMI_IN_CLASSIFICA ? "none" : "flex"
                      }; align-items:center; justify-content:space-between">
                        <a href="#/atleta?id=${a.userId}" style="display:flex; align-items:center; gap:8px; text-decoration:none; color:var(--text); min-width:0">
                          ${a.posizione ?? i + 1}. ${avatarHtml(a)} <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${a.nickname || a.nome}</span>
                        </a>
                        <strong style="flex:0 0 auto">${variazioneHtml(a.variazione)}${a.punti} PT</strong>
                      </div>
                    `
                  )
                  .join("")
              : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun punto ancora in questo periodo.</p>`
          }
        </div>
        ${
          classifica.length > PRIMI_IN_CLASSIFICA
            ? `<button type="button" class="tendina-btn classifica-altri">Vedi tutta la classifica (${classifica.length}) ▾</button>`
            : ""
        }
      </div>
    `;

    box.querySelectorAll(".periodo-btn").forEach((btn) => {
      btn.addEventListener("click", () => loadClassifica(el, btn.dataset.periodo));
    });

    const altriBtn = box.querySelector(".classifica-altri");
    altriBtn?.addEventListener("click", () => {
      const aperta = altriBtn.dataset.aperta !== "1";
      altriBtn.dataset.aperta = aperta ? "1" : "";
      box.querySelectorAll(".classifica-riga").forEach((r, i) => {
        if (i >= PRIMI_IN_CLASSIFICA) r.style.display = aperta ? "flex" : "none";
      });
      altriBtn.textContent = aperta ? "Mostra solo i primi 5 ▴" : `Vedi tutta la classifica (${classifica.length}) ▾`;
    });
  } catch {
    box.remove();
  }
}

// Un trofeo per mese di stagione (Set→Lug, 11 immagini), indicizzato per numero di mese —
// stessa logica di badge-mensili.js, file in frontend/public/trofei/trofeo_MM.png.
function trofeoUrl(mese) {
  return `/trofei/trofeo_${String(mese).padStart(2, "0")}.png`;
}

// "Atleta del mese" (assegnato automaticamente dal cron il giorno 1, vedi
// worker/src/lib/atletaMese.ts): il mese più recente in evidenza + lo storico a tendina.
// Sezione invisibile finché non c'è ancora nessun vincitore (niente da mostrare a vuoto).
async function loadAlboOro(el) {
  const box = el.querySelector("#albo-oro");
  try {
    const { attuale, storico } = await api.get("/atleta-mese");
    if (!storico.length) {
      box.remove();
      return;
    }

    const rigaVincitore = (v) => `
      <div style="display:flex; align-items:center; gap:8px">
        <a href="#/atleta?id=${v.userId}" style="display:flex; align-items:center; gap:8px; text-decoration:none; color:var(--text); min-width:0">
          ${avatarHtml(v)} <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${v.nickname || v.nome}</span>
        </a>
        <span class="mono" style="color:var(--mute); font-size:12px; margin-left:auto">${v.punti} PT</span>
      </div>
    `;

    box.innerHTML = `
      <div class="card">
        <p class="kicker">🏆 ATLETA DEL MESE</p>
        <div style="display:flex; align-items:center; gap:14px; margin-top:8px">
          <button type="button" class="badge-tile" data-badge-tipo="trofeo" data-mese="${attuale.mese}" data-anno="${attuale.anno}"
            data-punti="${attuale.vincitori[0].punti}" style="flex:0 0 auto; background:none; border:none; padding:0; cursor:pointer; line-height:0">
            <img src="${trofeoUrl(attuale.mese)}" alt="Trofeo di ${meseNome(`${attuale.anno}-${String(attuale.mese).padStart(2, "0")}`)}"
              style="width:84px; height:84px; object-fit:contain" />
          </button>
          <div style="flex:1; min-width:0">
            <p class="mono" style="color:var(--mute); font-size:12px">${meseNome(`${attuale.anno}-${String(attuale.mese).padStart(2, "0")}`)} ${attuale.anno}</p>
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:6px">
              ${attuale.vincitori.map(rigaVincitore).join("")}
            </div>
          </div>
        </div>
        ${storico.length > 1
          ? `<details class="blocco-mese" style="margin-top:10px">
               <summary>Albo d'oro · mesi precedenti</summary>
               <div class="blocco-corpo" style="display:flex; flex-direction:column; gap:10px">
                 ${storico
                   .slice(1)
                   .map(
                     (m) => `
                       <div style="display:flex; align-items:center; gap:10px">
                         <button type="button" class="badge-tile" data-badge-tipo="trofeo" data-mese="${m.mese}" data-anno="${m.anno}"
                           data-punti="${m.vincitori[0].punti}" style="flex:0 0 auto; background:none; border:none; padding:0; cursor:pointer; line-height:0">
                           <img src="${trofeoUrl(m.mese)}" alt="Trofeo di ${meseNome(`${m.anno}-${String(m.mese).padStart(2, "0")}`)}"
                             style="width:40px; height:40px; object-fit:contain" />
                         </button>
                         <div style="flex:1; min-width:0">
                           <p class="mono" style="color:var(--mute); font-size:11px; margin-bottom:4px">${meseNome(`${m.anno}-${String(m.mese).padStart(2, "0")}`)} ${m.anno}</p>
                           <div style="display:flex; flex-direction:column; gap:6px">${m.vincitori.map(rigaVincitore).join("")}</div>
                         </div>
                       </div>
                     `
                   )
                   .join("")}
               </div>
             </details>`
          : ""}
      </div>
    `;
  } catch {
    box.remove();
  }
}

// Sfida con più foto: "Foto caricate: 1 di 3" + un puntino per foto (pieno = caricata).
function fotoProgressoHtml(s) {
  if (!(s.fotoRichieste > 1)) return "";
  const puntini = Array.from({ length: s.fotoRichieste }, (_, i) =>
    `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:5px;
       background:${i < s.fotoCaricate ? "var(--accent)" : "var(--border)"}"></span>`
  ).join("");
  return `
    <p class="mono" style="font-size:13px; margin-top:10px">
      Foto caricate: <strong>${s.fotoCaricate} di ${s.fotoRichieste}</strong>
    </p>
    <div style="margin-top:6px">${puntini}</div>`;
}

// "Pausa pranzo 🍽️ — Una foto del tuo pranzo." → si vede solo il nome in grassetto; tocchi
// il nome e si apre la spiegazione sotto (troppo testo tutto insieme, Francesca nov 2026).
// Senza " — " la missione è solo il nome.
function missioneTestoHtml(m, dal) {
  // Casella del calendario ancora chiusa: il worker non manda il testo (sorpresa).
  if (m == null) return `<span style="color:var(--mute)">🔒 Si apre il ${dal ? `${dal.slice(8, 10)}/${dal.slice(5, 7)}` : "…"}</span>`;
  const [nome, ...resto] = m.split(" — ");
  const spiegazione = resto.join(" — ");
  if (!spiegazione) return `<span style="font-weight:600">${nome}</span>`;
  return `
    <details class="missione-dettaglio">
      <summary><span style="font-weight:600">${nome}</span></summary>
      <span class="mono" style="display:block; color:var(--mute); font-size:12px; margin-top:4px">${spiegazione}</span>
    </details>`;
}

// Sfida a tappe = una giornata raccontata in foto: una riga per missione. Fatta = miniatura
// della foto + ✓; da fare = bottone 📷 che apre la fotocamera (niente galleria: le foto si
// scattano dall'app, quel giorno) e carica subito (attachMissioni). Completata → collage.
function missioniHtml(s) {
  const fatte = new Map(s.missioniFatte.map((f) => [f.missione, f.foto]));
  if (s.partecipato) {
    const dati = { titolo: s.titolo, dataInizio: s.data_inizio, missioni: s.missioni, foto: s.missioni.map((_, i) => fatte.get(i)) };
    return `<div style="margin-top:12px">${collageHtml(dati)}</div>${scaricaCollageHtml(dati)}`;
  }
  const gg = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  // Calendario (es. Avvento): ogni casella si apre in un giorno di allenamento e da lì si
  // può fare quando si vuole, anche con una foto della galleria.
  const calendario = Array.isArray(s.missioniDal);
  const avviso = calendario
    ? `In ogni giorno di allenamento si apre una nuova casella: puoi farla quel giorno o quando vuoi dopo, entro il ${gg(s.data_fine)}.`
    : s.giornoLasciato
    ? `Il ${gg(s.giornoLasciato)} non avevi finito: le foto di quel giorno non valgono più, oggi si riparte da capo.`
    : fatte.size
      ? "Oggi è la tua giornata: scatta le foto che mancano entro mezzanotte!"
      : `Scegli un giorno di allenamento e scatta le ${s.missioni.length} foto dall'app, tutte lo stesso giorno. Se non finisci, un altro giorno si riparte da capo.`;
  const righe = s.missioni
    .map((m, i) => {
      const foto = fatte.get(i);
      const chiusa = m == null;
      const segno = chiusa
        ? `<span style="width:40px; height:40px; border-radius:8px; flex:0 0 auto; background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--mute)">${i + 1}</span>`
        : foto
        ? `<img src="${mediaUrl(foto)}" alt="" loading="lazy" style="width:40px; height:40px; object-fit:cover; border-radius:8px; flex:0 0 auto" />`
        : `<span style="width:40px; height:40px; border-radius:8px; flex:0 0 auto; border:2px dashed var(--border)"></span>`;
      const azione = foto
        ? `<span style="color:var(--livello-1); font-weight:600">✓</span>`
        : chiusa
        ? ""
        : `<label class="foto-btn" style="position:relative; flex:0 0 auto; padding:8px 12px; border-radius:10px;
                  background:var(--surface-2); color:var(--text); font-weight:600; font-size:14px; cursor:pointer">
             <span class="missione-txt">${calendario ? "📷 Foto" : "📷 Scatta"}</span>
             <input class="missione-input" type="file" accept="image/*"${calendario ? "" : ` capture="environment"`} style="position:absolute; width:1px; height:1px; opacity:0" />
           </label>`;
      return `
        <div class="missione-riga" data-missione="${i}" style="display:flex; align-items:flex-start; gap:10px">
          ${segno}
          <span style="flex:1; min-width:0; font-size:14px; padding-top:10px">${missioneTestoHtml(m, s.missioniDal?.[i])}</span>
          ${azione}
        </div>`;
    })
    .join("");
  return `
    <p class="mono" style="font-size:12px; margin-top:10px; padding:8px 10px; border-radius:8px; background:var(--surface-2)">📅 ${avviso}</p>
    <p class="mono" style="font-size:13px; margin-top:10px">
      Missioni completate: <strong>${fatte.size} di ${s.missioni.length}</strong>
    </p>
    <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px">${righe}</div>
    <p class="error-text foto-error" hidden style="margin-top:6px"></p>`;
}

// Sfida a calendario (Avvento, dic 2026): una griglia di giorni. Ogni casella si apre nel suo
// giorno; toccandola si vedono la missione, il tasto per la propria foto e il carosello con
// le foto di tutti (apriCasella). Idea di Francesca, nov 2026.
const giornoCorto = (d) => `${Number(d.slice(8, 10))}`;

const MESI_LUNGHI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

// Il mese intero come un calendario da muro (LUN–DOM): i giorni con una casella sono i
// riquadri da toccare (emoji / 🔒 / la tua foto), gli altri giorni solo il numero.
function calendarioHtml(s, oggi, { caricabile }) {
  const fatte = new Map(s.missioniFatte.map((f) => [f.missione, f.foto]));
  const perGiorno = new Map(s.missioniDal.map((d, i) => [d, i]));
  const primo = s.missioniDal.find(Boolean) ?? s.data_inizio;
  const anno = Number(primo.slice(0, 4));
  const mese = Number(primo.slice(5, 7));
  const giorniNelMese = new Date(anno, mese, 0).getDate();
  const vuoti = (new Date(anno, mese - 1, 1).getDay() + 6) % 7; // lunedì = 0
  const pad = (n) => String(n).padStart(2, "0");

  const casella = (i, g) => {
    const m = s.missioni[i];
    const dal = s.missioniDal[i];
    const aperta = !dal || dal <= oggi;
    const mia = fatte.get(i);
    const emoji = m ? nomeMissione(m).emoji : "";
    const sfondo = mia
      ? `background:center/cover no-repeat url('${mediaUrl(mia)}');`
      : aperta
        ? "background:color-mix(in srgb, var(--accent) 16%, var(--surface-2));"
        : "background:transparent; border:2px dashed var(--border);";
    const bordoOggi = dal === oggi ? "box-shadow:0 0 0 2px var(--accent);" : "";
    return `
      <button type="button" class="cal-casella" data-n="${i}"
        aria-label="Casella del ${g} ${MESI_LUNGHI[mese - 1].toLowerCase()}${mia ? ", fatta" : aperta ? "" : ", chiusa"}"
        style="position:relative; aspect-ratio:1; border:none; border-radius:8px; padding:0; cursor:pointer; overflow:hidden;
               color:var(--text); ${sfondo} ${bordoOggi}">
        ${mia ? `<span style="position:absolute; inset:0; background:linear-gradient(to bottom, rgba(0,0,0,.55), transparent 60%)"></span>` : ""}
        <span class="mono" style="position:absolute; top:3px; left:4px; font-weight:700; font-size:12px; line-height:1; ${mia ? "color:#fff;" : ""}">${g}</span>
        <span style="position:absolute; right:3px; bottom:2px; font-size:${mia ? "10px" : "15px"}; line-height:1;
                     ${aperta ? "" : "opacity:.5;"}">${mia ? "✅" : aperta ? emoji || "📷" : "🔒"}</span>
      </button>`;
  };

  const celle = [];
  for (let k = 0; k < vuoti; k++) celle.push("<span></span>");
  for (let g = 1; g <= giorniNelMese; g++) {
    const data = `${anno}-${pad(mese)}-${pad(g)}`;
    const i = perGiorno.get(data);
    celle.push(
      i != null
        ? casella(i, g)
        : `<span class="mono" style="aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:12px;
             color:var(--mute); opacity:.55; border-radius:8px; ${data === oggi ? "box-shadow:inset 0 0 0 1px var(--border);" : ""}">${g}</span>`
    );
  }
  const intestazione = ["L", "M", "M", "G", "V", "S", "D"]
    .map((d) => `<span class="mono" style="text-align:center; font-size:10px; font-weight:700; color:var(--mute)">${d}</span>`)
    .join("");

  const avviso = caricabile
    ? `Tocca un giorno colorato per vedere la missione e le foto di tutti. Ogni casella si apre nel suo giorno e puoi farla anche dopo, entro il ${giornoCorto(s.data_fine)}/${s.data_fine.slice(5, 7)}.`
    : "Tocca un giorno colorato per vedere la missione e le foto di tutti.";
  return `
    <div style="margin-top:12px; padding:12px 10px 10px; border-radius:14px; border:1px solid var(--border); background:var(--surface)">
      <p style="text-align:center; font-family:var(--font-ui); font-weight:800; font-size:18px; text-transform:uppercase; letter-spacing:.5px">
        🎄 ${MESI_LUNGHI[mese - 1]} ${anno}</p>
      <div style="display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:4px; margin-top:8px">${intestazione}</div>
      <div class="cal-griglia" data-caricabile="${caricabile ? 1 : 0}"
        style="display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:4px; margin-top:4px">${celle.join("")}</div>
    </div>
    <p class="mono" style="font-size:12px; margin-top:10px; padding:8px 10px; border-radius:8px; background:var(--surface-2)">📅 ${avviso}</p>
    ${s.partecipato ? `<p class="mono" style="color:var(--livello-1); font-size:13px; margin-top:10px">✓ Completata</p>` : ""}`;
}

const escHtml = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const CHIUDI_BTN = `<button type="button" class="cal-chiudi" aria-label="Chiudi"
  style="position:absolute; top:10px; right:12px; border:none; background:none; color:var(--mute); font-size:20px; cursor:pointer">✕</button>`;

// Come avatarHtml, ma più grande: in testa a ogni foto del carosello del calendario.
function avatarGrandeHtml(a) {
  const nome = a.nickname || a.nome || "?";
  const cerchio = (display) =>
    `<span style="display:${display}; width:34px; height:34px; flex:0 0 auto; border-radius:50%; background:var(--surface-2);
       align-items:center; justify-content:center; font-size:15px; font-weight:700; color:var(--mute)">${escHtml(nome[0].toUpperCase())}</span>`;
  if (a.fotoUrl) {
    return `<img src="${mediaUrl(a.fotoUrl)}" alt=""
       onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"
       style="width:34px; height:34px; flex:0 0 auto; border-radius:50%; object-fit:cover" />${cerchio("none")}`;
  }
  return cerchio("inline-flex");
}

// Unisce due foto ("prima" e "dopo") in un collage verticale 1000×1500: prima sopra, dopo
// sotto, ognuna ritagliata al centro in 4:3, con l'etichetta PRIMA / DOPO. Francesca, nov 2026.
async function unisciPrimaDopo(primaFile, dopoFile) {
  const W = 1000;
  const H = 750;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d");
  const files = [primaFile, dopoFile];
  for (let k = 0; k < 2; k++) {
    const img = await createImageBitmap(files[k], { imageOrientation: "from-image" });
    const scala = Math.max(W / img.width, H / img.height);
    const w = img.width * scala;
    const h = img.height * scala;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, k * H, W, H);
    ctx.clip();
    ctx.drawImage(img, (W - w) / 2, k * H + (H - h) / 2, w, h);
    ctx.restore();
    img.close?.();
    const etichetta = k === 0 ? "PRIMA" : "DOPO";
    ctx.font = "700 48px sans-serif";
    const tw = ctx.measureText(etichetta).width;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(28, k * H + 28, tw + 36, 70);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(etichetta, 46, k * H + 64);
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, H - 4, W, 8);
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  return new File([blob], "prima-dopo.jpg", { type: "image/jpeg" });
}

// La casella aperta: missione, la propria foto (o il tasto per caricarla) e il carosello con
// le foto di tutti per quel giorno. Dopo un caricamento ricarica le sfide (onDone) e si ridisegna.
async function apriCasella(sfidaId, n, { caricabile, onDone, onCompletata }) {
  const ov = document.createElement("div");
  ov.className = "cal-dettaglio";
  ov.style.cssText =
    "position:fixed; inset:0; z-index:200; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:16px";
  ov.innerHTML = `<div role="dialog" aria-modal="true" class="cal-box"
      style="position:relative; width:100%; max-width:420px; max-height:90vh; overflow-y:auto; background:var(--surface);
             border:1px solid var(--border); border-radius:18px; padding:20px 16px 18px">
      <p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>`;
  const box = ov.querySelector(".cal-box");
  const chiudi = () => {
    ov.remove();
    document.removeEventListener("keydown", suEsc);
  };
  const suEsc = (e) => e.key === "Escape" && chiudi();
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest(".cal-chiudi")) chiudi();
  });
  document.addEventListener("keydown", suEsc);
  document.body.appendChild(ov);

  const disegna = async (vaiAllaMia = false) => {
    let d;
    try {
      d = await api.get(`/sfide/${sfidaId}/caselle/${n}`);
    } catch (err) {
      box.innerHTML = `${CHIUDI_BTN}
        <p style="font-weight:600; padding-right:24px">🔒 ${escHtml(err instanceof ApiError ? err.message : "Errore imprevisto")}</p>`;
      return;
    }
    const [nome, ...resto] = d.missione.split(" — ");
    const spiegazione = resto.join(" — ");
    const giorno = d.dal
      ? new Date(`${d.dal}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })
      : "";
    const mia = d.foto.find((f) => f.mia);
    const tot = d.foto.length;
    const doppia = d.fotoPerCasella === 2;
    const slot = (k, testo) => `
      <label class="cal-slot" data-k="${k}" style="position:relative; flex:1; aspect-ratio:4/5; border-radius:12px; cursor:pointer;
             border:2px dashed var(--border); display:flex; align-items:center; justify-content:center; overflow:hidden;
             background:var(--surface-2) center/cover no-repeat">
        <span class="mono cal-slot-txt" style="font-size:13px; font-weight:700; text-align:center; padding:4px 8px; border-radius:8px">📷 ${testo}</span>
        <input class="cal-input-doppia" type="file" accept="image/*" style="position:absolute; width:1px; height:1px; opacity:0" />
      </label>`;
    // Didascalia facoltativa, scritta prima di scegliere la foto (si può cambiare dopo).
    const campoDidascalia = `
      <textarea class="cal-didascalia" maxlength="200" rows="2" placeholder="Scrivi una didascalia (facoltativa)"
        style="width:100%; margin-top:14px; padding:10px 12px; border-radius:12px; border:1px solid var(--border);
               background:var(--surface-2); color:var(--text); font:inherit; font-size:14px; resize:vertical; box-sizing:border-box"></textarea>`;
    const mioBlocco = mia
      ? `<p class="mono" style="color:var(--livello-1); font-size:13px; margin-top:12px">✓ La tua foto è nel calendario</p>`
      : caricabile && doppia
        ? `<div style="display:flex; gap:8px; margin-top:14px">${slot(0, "Prima")}${slot(1, "Dopo")}</div>
           ${campoDidascalia}
           <button type="button" class="btn cal-carica-doppia" disabled style="width:100%; margin-top:10px">Scegli le due foto</button>
           <p class="error-text cal-errore" hidden style="margin-top:6px"></p>`
      : caricabile
        ? `${campoDidascalia}
           <label class="foto-btn" style="position:relative; display:block; text-align:center; margin-top:10px; padding:12px; border-radius:12px;
                  background:var(--accent); color:#fff; font-weight:700; cursor:pointer">
             <span class="cal-carica-txt">📷 Carica la tua foto</span>
             <input class="cal-input" type="file" accept="image/*" style="position:absolute; width:1px; height:1px; opacity:0" />
           </label>
           <p class="error-text cal-errore" hidden style="margin-top:6px"></p>`
        : "";
    // Ogni foto come un post: in alto chi l'ha messa (foto profilo + nome), poi la foto e
    // sotto la didascalia. Sulla propria si può aggiungere o cambiare la didascalia.
    const slide = (f) => {
      const nomeAtleta = escHtml(f.nickname || f.nome || "Atleta");
      return `
      <div style="flex:0 0 100%; scroll-snap-align:start; min-width:0">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px">
          ${avatarGrandeHtml(f)}
          <span style="font-weight:700; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${nomeAtleta}</span>
          ${f.mia ? `<span class="mono" style="font-size:11px; color:var(--mute)">(tu)</span>` : ""}
        </div>
        <img src="${mediaUrl(f.foto)}" alt="Foto di ${nomeAtleta}" loading="lazy" decoding="async"
          style="width:100%; aspect-ratio:${d.fotoPerCasella === 2 ? "2/3" : "4/5"}; object-fit:cover; border-radius:12px; display:block; background:var(--surface-2)" />
        <div class="cal-didascalia-box" style="margin-top:8px; font-size:14px; line-height:1.4">
          ${f.didascalia ? `<p style="white-space:pre-line; overflow-wrap:anywhere"><strong>${nomeAtleta}</strong> ${escHtml(f.didascalia)}</p>` : ""}
          ${f.mia ? `<button type="button" class="cal-modifica-didascalia mono" data-testo="${escHtml(f.didascalia ?? "")}"
              style="margin-top:4px; padding:0; border:none; background:none; color:var(--accent); font-size:12px; cursor:pointer">
              ✏️ ${f.didascalia ? "Modifica la didascalia" : "Aggiungi una didascalia"}</button>` : ""}
        </div>
      </div>`;
    };
    const frecce = [["prev", "‹", "left:6px"], ["next", "›", "right:6px"]]
      .map(([dir, simbolo, lato]) => `
        <button type="button" class="cal-car-${dir}" aria-label="${dir === "prev" ? "Foto precedente" : "Foto successiva"}"
          style="position:absolute; top:40%; ${lato}; transform:translateY(-50%); width:32px; height:32px; border:none;
                 border-radius:50%; background:rgba(255,255,255,.85); color:#000; font-size:22px; line-height:1; cursor:pointer;
                 display:${dir === "prev" ? "none" : "flex"}; align-items:center; justify-content:center;
                 box-shadow:0 1px 4px rgba(0,0,0,.3)">${simbolo}</button>`)
      .join("");
    const carosello = tot
      ? `<div style="position:relative; margin-top:8px">
          <div class="cal-car" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none;
               -webkit-overflow-scrolling:touch; border-radius:12px">${d.foto.map(slide).join("")}</div>
          ${tot > 1 ? `<span class="cal-car-cont mono" style="position:absolute; top:50px; right:8px; background:rgba(0,0,0,.6); color:#fff;
                font-size:12px; padding:3px 8px; border-radius:10px">1/${tot}</span>${frecce}` : ""}
        </div>`
      : `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:8px; padding:24px 10px; text-align:center;
            border:2px dashed var(--border); border-radius:12px">Ancora nessuna foto: inizia tu! 📸</p>`;

    box.innerHTML = `${CHIUDI_BTN}
      <p class="kicker" style="text-transform:uppercase">${escHtml(giorno)}</p>
      <p style="font-family:var(--font-ui); font-weight:800; font-size:22px; margin-top:4px; padding-right:24px">${escHtml(nome)}</p>
      ${spiegazione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">${escHtml(spiegazione)}</p>` : ""}
      ${mioBlocco}
      <p class="mono" style="font-size:12px; margin-top:18px; text-transform:uppercase; letter-spacing:.5px">Le foto di tutti · ${tot}</p>
      ${carosello}`;

    const car = box.querySelector(".cal-car");
    if (car && tot > 1) {
      const cont = box.querySelector(".cal-car-cont");
      const prev = box.querySelector(".cal-car-prev");
      const next = box.querySelector(".cal-car-next");
      const indice = () => Math.round(car.scrollLeft / car.clientWidth);
      const aggiorna = () => {
        const i = indice();
        cont.textContent = `${i + 1}/${tot}`;
        prev.style.display = i > 0 ? "flex" : "none";
        next.style.display = i < tot - 1 ? "flex" : "none";
      };
      car.addEventListener("scroll", aggiorna, { passive: true });
      prev.addEventListener("click", () => car.scrollTo({ left: Math.max(0, indice() - 1) * car.clientWidth }));
      next.addEventListener("click", () => car.scrollTo({ left: Math.min(tot - 1, indice() + 1) * car.clientWidth }));
      if (vaiAllaMia) {
        const i = d.foto.findIndex((f) => f.mia);
        if (i > 0) requestAnimationFrame(() => car.scrollTo({ left: i * car.clientWidth }));
      }
    }

    const errEl = box.querySelector(".cal-errore");
    // Carica la foto della casella; `false` se non è andata (l'errore è già a schermo).
    const carica = async (file) => {
      errEl.hidden = true;
      const formData = new FormData();
      formData.append("foto", file);
      formData.append("missione", String(n));
      const didascalia = box.querySelector(".cal-didascalia")?.value.trim();
      if (didascalia) formData.append("didascalia", didascalia);
      try {
        const r = await api.postForm(`/sfide/${sfidaId}/partecipa`, formData);
        if (r?.completata) onCompletata?.();
        onDone?.();
        await disegna(true);
        return true;
      } catch (err) {
        errEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errEl.hidden = false;
        return false;
      }
    };

    // Didascalia della propria foto: il bottone ✏️ apre un campo con Salva / Annulla.
    box.querySelector(".cal-modifica-didascalia")?.addEventListener("click", (e) => {
      const btn = e.currentTarget;
      const contenitore = btn.closest(".cal-didascalia-box");
      contenitore.innerHTML = `
        <textarea class="cal-didascalia-edit" maxlength="200" rows="2" placeholder="Scrivi una didascalia"
          style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--border); background:var(--surface-2);
                 color:var(--text); font:inherit; font-size:14px; resize:vertical; box-sizing:border-box"></textarea>
        <div style="display:flex; gap:8px; margin-top:6px">
          <button type="button" class="btn cal-salva-didascalia" style="flex:1">Salva</button>
          <button type="button" class="btn cal-annulla-didascalia" style="flex:1; background:var(--surface-2); color:var(--text)">Annulla</button>
        </div>
        <p class="error-text cal-errore-didascalia" hidden style="margin-top:6px"></p>`;
      const area = contenitore.querySelector("textarea");
      area.value = btn.dataset.testo;
      area.focus();
      contenitore.querySelector(".cal-annulla-didascalia").addEventListener("click", () => disegna(true));
      contenitore.querySelector(".cal-salva-didascalia").addEventListener("click", async (ev) => {
        ev.currentTarget.disabled = true;
        try {
          await api.post(`/sfide/${sfidaId}/caselle/${n}/didascalia`, { didascalia: area.value });
          await disegna(true);
        } catch (err) {
          const er = contenitore.querySelector(".cal-errore-didascalia");
          er.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
          er.hidden = false;
          ev.currentTarget.disabled = false;
        }
      });
    });

    const input = box.querySelector(".cal-input");
    input?.addEventListener("change", async () => {
      if (!input.files[0]) return;
      const txt = box.querySelector(".cal-carica-txt");
      txt.textContent = "Carico...";
      input.disabled = true;
      if (!(await carica(input.files[0]))) {
        txt.textContent = "📷 Carica la tua foto";
        input.disabled = false;
        input.value = "";
      }
    });

    // "Prima e dopo": due foto scelte nei due riquadri, unite in una sola immagine.
    const scelte = [null, null];
    const btnDoppia = box.querySelector(".cal-carica-doppia");
    box.querySelectorAll(".cal-slot").forEach((lab) => {
      const inp = lab.querySelector("input");
      inp.addEventListener("change", () => {
        const f = inp.files[0];
        if (!f) return;
        scelte[Number(lab.dataset.k)] = f;
        lab.style.backgroundImage = `url('${URL.createObjectURL(f)}')`;
        lab.style.borderStyle = "solid";
        const t = lab.querySelector(".cal-slot-txt");
        t.textContent = lab.dataset.k === "0" ? "Prima ✓" : "Dopo ✓";
        t.style.background = "rgba(0,0,0,.6)";
        t.style.color = "#fff";
        const pronte = scelte.every(Boolean);
        btnDoppia.disabled = !pronte;
        btnDoppia.textContent = pronte ? "Carica prima e dopo" : "Scegli le due foto";
      });
    });
    btnDoppia?.addEventListener("click", async () => {
      btnDoppia.disabled = true;
      btnDoppia.textContent = "Carico...";
      try {
        const unita = await unisciPrimaDopo(scelte[0], scelte[1]);
        if (await carica(unita)) return;
      } catch {
        errEl.textContent = "Non riesco a leggere una delle due foto, prova con un'altra";
        errEl.hidden = false;
      }
      btnDoppia.disabled = false;
      btnDoppia.textContent = "Carica prima e dopo";
    });
  };
  await disegna();
}

// Una singola sfida come riga dentro la card del mese. Le completate restano visibili
// ma "archiviate" (classe .done -> opacità ridotta + esito riuscito).
function sfidaItemHtml(s, oggi) {
  if (s.votazione) return sfidaVotazioneHtml(s);
  // Sfida flash segreta (il worker manda titolo/descrizione null fino a data_inizio): si vede
  // che c'è, ma "glitchata", senza nome né contenuto.
  if (s.nascosta) {
    const giorno = `${s.data_inizio.slice(8, 10)}/${s.data_inizio.slice(5, 7)}`;
    return `
      <div class="sfida-item sfida-glitch" data-id="${s.id}">
        <p class="mono" style="font-size:11px"><span style="color:var(--sessione-b)">⚡ SFIDA FLASH</span></p>
        <p class="glitch-testo" data-testo="▓█▒░ ▒▓█░▒▓" aria-label="Sfida segreta">▓█▒░ ▒▓█░▒▓</p>
        <p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">██▒ ░▓█▒ ▒░█ ▓▒░█ ░▒▓ █▒░▓▒</p>
        <p class="mono" style="color:var(--accent); font-size:13px; margin-top:8px">+${s.punti} PT · ??? partecipanti</p>
        <button class="btn" style="width:100%; margin-top:10px" disabled>Si svela il ${giorno}</button>
      </div>
    `;
  }
  const scaduta = s.data_fine < oggi;
  const nonIniziata = s.data_inizio > oggi;
  const done = !!s.partecipato;
  const isCoach = getUser()?.role === "coach";
  const aTappe = s.tipo === "foto" && Array.isArray(s.missioni);
  const calendario = aTappe && Array.isArray(s.missioniDal);
  const conRighe = aTappe && !calendario && !isCoach && (done || (!scaduta && !nonIniziata));
  // Coach o sfida chiusa: le missioni solo come elenco, senza caricamento.
  const elencoMissioni = aTappe && !calendario && !conRighe
    ? `<ul class="mono" style="font-size:13px; margin:8px 0 0; padding-left:18px">${s.missioni.map((m, i) => `<li style="margin-top:4px">${missioneTestoHtml(m, s.missioniDal?.[i])}</li>`).join("")}</ul>`
    : "";
  const azione = calendario
    ? calendarioHtml(s, oggi, { caricabile: !done && !scaduta && !nonIniziata })
    : conRighe
    ? `${missioniHtml(s)}${
        done ? `<p class="mono" style="color:var(--livello-1); font-size:13px; margin-top:10px">✓ Completata</p>` : ""
      }`
    : done
    ? `<p class="mono" style="color:var(--livello-1); font-size:13px; margin-top:10px">✓ Completata</p>`
    : scaduta
      ? `<button class="btn" style="width:100%; margin-top:10px" disabled>Sfida terminata</button>`
      : nonIniziata && s.tipo !== "traguardo"
      ? `<button class="btn" style="width:100%; margin-top:10px" disabled>Si apre il ${s.data_inizio.slice(8, 10)}/${s.data_inizio.slice(5, 7)}</button>`
      : s.tipo === "traguardo"
        ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:10px">${criterioTesto(s.criterio)}</p>`
        : isCoach
          ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:10px">Come coach non partecipi alle sfide.</p>`
          : s.tipo === "foto"
            ? `
          ${fotoProgressoHtml(s)}
          ${fotoInputHtml("foto-input", { galleria: true })}
          <p class="error-text foto-error" hidden style="margin-top:6px"></p>
          <button class="btn partecipa-btn" style="width:100%; margin-top:10px">${
            s.fotoRichieste > 1 ? `Carica la foto ${s.fotoCaricate + 1} di ${s.fotoRichieste}` : "Carica foto e partecipa"
          }</button>
        `
            : `<button class="btn partecipa-btn" style="width:100%; margin-top:10px">Partecipa</button>`;

  // Sfida a tappe: testo lungo, quindi a tendina (chiusa di default) — dalla riga chiusa si
  // vedono titolo, punti e a che punto sei. Richiesta di Francesca, nov 2026.
  if (aTappe) {
    const stato = done
      ? `<span style="color:var(--livello-1)">✓ Completata</span>`
      : calendario
        ? `${s.missioniFatte.length}/${s.missioni.length} caselle`
        : conRighe ? `${s.missioniFatte.length}/${s.missioni.length} missioni` : `${s.missioni.length} ${calendario ? "caselle" : "missioni"}`;
    return `
      <details class="sfida-item sfida-tappe" data-id="${s.id}" data-tipo="${s.tipo}"${tappeAperte.has(s.id) ? " open" : ""}>
        <summary>
          <span style="flex:1; min-width:0">
            <span class="mono" style="display:block; color:var(--mute); font-size:11px">${TIPO_LABEL[s.tipo] ?? s.tipo} · ${Array.isArray(s.missioniDal) ? "CALENDARIO" : "A TAPPE"}</span>
            <span style="display:block; font-weight:600; margin-top:2px">${s.titolo}</span>
            <span class="mono" style="display:block; color:var(--accent); font-size:13px; margin-top:6px">+${s.punti} PT · ${stato}</span>
          </span>
        </summary>
        ${s.descrizione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:8px">${s.descrizione}</p>` : ""}
        ${elencoMissioni}
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:8px">${s.numeroPartecipanti} partecipanti</p>
        ${azione}
      </details>
    `;
  }

  return `
    <div class="sfida-item${done ? " done" : ""}" data-id="${s.id}" data-tipo="${s.tipo}">
      <p class="mono" style="color:var(--mute); font-size:11px">${
        s.flash ? `<span style="color:var(--sessione-b)">⚡ LAMPO</span> · ` : ""
      }${TIPO_LABEL[s.tipo] ?? s.tipo}${done ? " · ARCHIVIATA" : ""}</p>
      <p style="font-weight:600; margin-top:2px">${s.titolo}</p>
      ${s.descrizione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">${s.descrizione}</p>` : ""}
      ${elencoMissioni}
      <p class="mono" style="color:var(--accent); font-size:13px; margin-top:8px">+${s.punti} PT · ${s.numeroPartecipanti} partecipanti</p>
      ${azione}
    </div>
  `;
}

// "2026-10-31 14:00" → "31/10 alle 14:00"
function quandoTesto(t) {
  return `${t.slice(8, 10)}/${t.slice(5, 7)} alle ${t.slice(11, 16)}`;
}

// Sfida foto con votazione (es. Halloween): fino a votazione_dal si carica la foto, che resta
// segreta; poi la galleria per votare la più bella, e infine il risultato. La galleria la
// riempie attachVotazione (GET /sfide/:id/votazione).
function sfidaVotazioneHtml(s) {
  const done = !!s.partecipato;
  const isCoach = getUser()?.role === "coach";
  let corpo;
  if (s.votazione === "caricamento") {
    corpo = done
      ? `<p class="mono" style="color:var(--livello-1); font-size:13px; margin-top:10px">✓ Foto caricata · si vota il ${quandoTesto(s.votazione_dal)}</p>`
      : isCoach
        ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:10px">Come coach non partecipi alle sfide.</p>`
        : `
          ${fotoInputHtml("foto-input", { galleria: true })}
          <p class="error-text foto-error" hidden style="margin-top:6px"></p>
          <button class="btn partecipa-btn" style="width:100%; margin-top:10px">Carica foto e partecipa</button>
          <p class="mono" style="color:var(--mute); font-size:12px; margin-top:8px">🤫 Le foto restano segrete fino al ${quandoTesto(s.votazione_dal)}: poi si vota la più bella.</p>`;
  } else {
    corpo = `<div class="vota-box" data-sfida="${s.id}" style="margin-top:12px">
      <p class="mono" style="color:var(--mute); font-size:13px">Carico le foto...</p></div>`;
  }

  return `
    <div class="sfida-item" data-id="${s.id}" data-tipo="${s.tipo}">
      <p class="mono" style="color:var(--mute); font-size:11px">${
        s.flash ? `<span style="color:var(--sessione-b)">⚡ LAMPO</span> · ` : ""
      }${TIPO_LABEL[s.tipo] ?? s.tipo}</p>
      <p style="font-weight:600; margin-top:2px">${s.titolo}</p>
      ${s.descrizione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px">${s.descrizione}</p>` : ""}
      <p class="mono" style="color:var(--accent); font-size:13px; margin-top:8px">+${s.punti} PT a tutte · +${s.punti + s.puntiVincitore} alla più votata · ${s.numeroPartecipanti} ${s.numeroPartecipanti === 1 ? "foto" : "foto caricate"}</p>
      ${corpo}
    </div>
  `;
}

function fotoVotoHtml(f, { fase, mioVoto, isCoach }) {
  // Fino ai risultati le foto arrivano anonime (senza nome).
  const nome = f.mia ? "La tua foto" : f.nickname || f.nome || "";
  const votata = mioVoto === f.id;
  const voti = f.voti != null ? `<span class="mono" style="font-size:12px; color:var(--mute)">${f.voti} ${f.voti === 1 ? "voto" : "voti"}</span>` : "";
  let azione = "";
  if (fase === "voto") {
    azione = f.mia
      ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Non votabile</p>`
      : `<button type="button" class="btn vota-btn${votata ? "" : " btn-secondary"}" data-foto="${f.id}"
           style="width:100%; margin-top:4px; padding:8px; font-size:13px${votata ? "" : "; background:var(--surface-2); color:var(--text)"}">${
           votata ? "Votata ✓" : "Vota"
         }</button>`;
  }
  return `
    <div class="vota-foto" style="min-width:0">
      <div style="position:relative">
        <img src="${mediaUrl(f.foto)}" alt="${nome ? `Foto di ${nome}` : "Foto"}" loading="lazy" class="vota-img"
          style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:10px; display:block; cursor:zoom-in;
                 ${votata ? "outline:3px solid var(--accent); outline-offset:-3px;" : ""}" />
        ${f.vincitrice ? `<span style="position:absolute; top:6px; left:6px; font-size:20px">🏆</span>` : ""}
        ${votata ? `<span style="position:absolute; top:6px; right:6px; background:var(--accent); color:#fff; border-radius:50%; width:22px; height:22px; font-size:13px; display:flex; align-items:center; justify-content:center">✓</span>` : ""}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-top:4px">
        <span style="font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${votata ? "color:var(--accent)" : ""}">${nome}</span>
        ${voti}
      </div>
      ${azione}
    </div>`;
}

async function disegnaVotazione(box) {
  const id = box.dataset.sfida;
  let v;
  try {
    v = await api.get(`/sfide/${id}/votazione`);
  } catch (err) {
    box.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
    return;
  }
  const isCoach = getUser()?.role === "coach";
  const opz = { fase: v.fase, mioVoto: v.mioVoto, isCoach };

  if (!v.foto.length) {
    box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessuna foto caricata 👻</p>`;
    return;
  }

  let testa = "";
  let lista = v.foto;
  if (v.fase === "voto") {
    testa = `
      <p style="font-weight:600">🗳️ Vota la foto più bella</p>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">${
        `Hai un voto: puoi cambiarlo fino a mezzanotte. Tocca una foto per ingrandirla.`
      }</p>`;
  } else if (v.fase === "attesa") {
    testa = `
      <p style="font-weight:600">🤫 Votazione chiusa</p>
      <p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px">Il risultato esce il ${quandoTesto(v.risultatiDal)}, insieme all'Atleta del mese 🏆</p>`;
  } else {
    const vincitrici = v.foto.filter((f) => f.vincitrice);
    lista = v.foto.filter((f) => !f.vincitrice);
    testa = vincitrici.length
      ? `
        <p style="font-weight:600">🏆 ${vincitrici.length > 1 ? "Le foto più votate" : "La foto più votata"}</p>
        ${vincitrici
          .map(
            (f) => `
          <img src="${mediaUrl(f.foto)}" alt="" class="vota-img" style="width:100%; max-height:360px; object-fit:cover; border-radius:12px; display:block; margin-top:8px; cursor:zoom-in" />
          <p style="font-weight:600; margin-top:6px">${f.mia ? "La tua foto" : f.nickname || f.nome} · ${f.voti} ${f.voti === 1 ? "voto" : "voti"}</p>
          <p class="mono" style="color:var(--accent); font-size:13px">${v.puntiTotali} punti 🎉</p>`
          )
          .join("")}`
      : `<p style="font-weight:600">Nessun voto 👻</p>`;
  }

  box.innerHTML = `
    ${testa}
    ${lista.length ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px">${lista.map((f) => fotoVotoHtml(f, opz)).join("")}</div>` : ""}
    <p class="error-text vota-error" hidden style="margin-top:6px"></p>
  `;

  // Tocco sulla foto: la ingrandisce a tutta larghezza (e la riporta piccola).
  box.querySelectorAll(".vota-foto .vota-img").forEach((img) => {
    img.addEventListener("click", () => {
      const cella = img.closest(".vota-foto");
      const grande = cella.style.gridColumn !== "1 / -1";
      cella.style.gridColumn = grande ? "1 / -1" : "";
      img.style.aspectRatio = grande ? "auto" : "1";
      img.style.objectFit = grande ? "contain" : "cover";
      img.style.cursor = grande ? "zoom-out" : "zoom-in";
    });
  });

  box.querySelectorAll(".vota-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await api.post(`/sfide/${id}/vota`, { fotoId: Number(btn.dataset.foto) });
        await disegnaVotazione(box);
      } catch (err) {
        const e = box.querySelector(".vota-error");
        e.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        e.hidden = false;
        btn.disabled = false;
      }
    });
  });
}

function attachVotazione(container) {
  container.querySelectorAll(".vota-box").forEach((box) => disegnaVotazione(box));
}

// Tendine delle sfide a tappe aperte: la pagina si ridisegna a ogni foto caricata, così
// restano aperte invece di richiudersi sotto il dito.
const tappeAperte = new Set();

// Sfida a tappe: scelta la foto di una missione la carica subito, senza bottone di conferma.
function attachMissioni(container, el, onDone) {
  container.querySelectorAll(".sfida-tappe").forEach((d) => {
    d.addEventListener("toggle", () => {
      const id = Number(d.dataset.id);
      if (d.open) tappeAperte.add(id);
      else tappeAperte.delete(id);
    });
  });
  attachCollage(container);
  container.querySelectorAll(".cal-casella").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cardEl = btn.closest("[data-id]");
      const caricabile = btn.closest(".cal-griglia").dataset.caricabile === "1";
      apriCasella(cardEl.dataset.id, Number(btn.dataset.n), {
        caricabile,
        onDone,
        onCompletata: () => loadClassifica(el, "mese"),
      });
    });
  });
  container.querySelectorAll(".missione-input").forEach((input) => {
    input.addEventListener("change", async () => {
      if (!input.files[0]) return;
      const cardEl = input.closest("[data-id]");
      const riga = input.closest(".missione-riga");
      const errorEl = cardEl.querySelector(".foto-error");
      const txt = riga.querySelector(".missione-txt");
      txt.dataset.testo ??= txt.textContent;
      errorEl.hidden = true;
      txt.textContent = "Carico...";
      input.disabled = true;

      const formData = new FormData();
      formData.append("foto", input.files[0]);
      formData.append("missione", riga.dataset.missione);
      try {
        const r = await api.postForm(`/sfide/${cardEl.dataset.id}/partecipa`, formData);
        if (r?.completata) loadClassifica(el, "mese");
        onDone();
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
        txt.textContent = txt.dataset.testo ?? "📷 Scatta";
        input.disabled = false;
        input.value = "";
      }
    });
  });
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

// Sfida extra a foto: carica la foto → punti + post nel Feed (POST /sfide-extra/:id/partecipa).
function attachPartecipaExtra(box, el, onDone) {
  box.querySelectorAll(".extra-partecipa-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest("[data-extra-id]");
      const errorEl = item.querySelector(".extra-foto-error");
      const input = item.querySelector(".extra-foto-input");
      if (!input.files[0]) {
        errorEl.textContent = "Scegli o scatta una foto per completare la sfida";
        errorEl.hidden = false;
        return;
      }
      const formData = new FormData();
      formData.append("foto", input.files[0]);
      btn.disabled = true;
      try {
        await api.postForm(`/sfide-extra/${item.dataset.extraId}/partecipa`, formData);
        loadClassifica(el, "mese");
        onDone();
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : "Errore imprevisto";
        errorEl.hidden = false;
        btn.disabled = false;
      }
    });
  });
}

// Box "Sfide extra" del mese mostrato nel carosello: non contano per la coccarda (le sfide
// del mese restano alla portata di tutti). Di solito solo da leggere; quelle "a foto" (es. il
// trekking del 18/10) si completano caricando la foto nei giorni in cui sono aperte.
function sfideExtraHtml(righe) {
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const dd = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
  const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }); // "YYYY-MM-DD"
  const isCoach = getUser()?.role === "coach";
  const conFoto = righe.some((r) => r.foto);

  const azioneFoto = (r) => {
    if (r.fatta) return `<p class="mono" style="color:var(--mese-accento, var(--accent)); font-size:13px; margin-top:10px">✓ Completata</p>`;
    if (isCoach) return `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:10px">Gli atleti la completano caricando una foto${r.apertaDal ? ` dal ${dd(r.apertaDal)}` : ""}${r.apertaFino ? ` al ${dd(r.apertaFino)}` : ""}.</p>`;
    if (r.apertaDal && r.apertaDal > oggi)
      return `<button class="btn" style="width:100%; margin-top:10px" disabled>Si apre il ${dd(r.apertaDal)}</button>`;
    if (r.apertaFino && r.apertaFino < oggi)
      return `<button class="btn" style="width:100%; margin-top:10px" disabled>Sfida terminata</button>`;
    return `
      ${fotoInputHtml("extra-foto-input", { galleria: true })}
      <p class="error-text extra-foto-error" hidden style="margin-top:6px"></p>
      <button class="btn extra-partecipa-btn" style="width:100%; margin-top:10px">Carica foto e completa</button>
      ${r.apertaFino ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:6px; text-align:center">Puoi caricarla fino al ${dd(r.apertaFino)}</p>` : ""}`;
  };

  return `
    <div class="extra-head">
      <span class="extra-plus" aria-hidden="true">+</span>
      <h2 class="extra-title">Sfide extra</h2>
    </div>
    <p class="mono extra-sub">
      ${conFoto
        ? "Punti in più per la classifica, non contano per la coccarda del mese. Alcune arrivano da sole, per altre carichi tu la foto."
        : "Punti in più per la classifica. Non devi fare niente: i punti arrivano da soli, in base alle tue presenze o assegnati dalla coach."}
    </p>
    ${righe
      .map(
        (r) => `
      <div class="extra-item" data-extra-id="${r.id}">
        <p style="font-weight:700">${esc(r.titolo)}</p>
        ${r.descrizione ? `<p class="mono" style="color:var(--mute); font-size:13px; margin-top:4px; line-height:1.5">${esc(r.descrizione)}</p>` : ""}
        ${r.punti ? `<span class="mono extra-pill">+${r.punti} PT</span>` : ""}
        ${r.data ? `<span class="mono" style="color:var(--mute); font-size:12px; margin-left:${r.punti ? 8 : 0}px">il ${dd(r.data)}</span>` : ""}
        ${r.foto
          ? azioneFoto(r)
          : r.fatta
            ? `<p class="mono" style="color:var(--mese-accento, var(--accent)); font-size:13px; margin-top:10px">✓ Completata</p>`
            : ""}
      </div>`
      )
      .join("")}`;
}

// Card del mese a tendina: chiusa all'apertura della pagina; resta aperta/chiusa quando si
// cambia mese o si ricarica dopo aver partecipato a una sfida.
let sfideAperte = false;

// Blocco Sfide: una card che raccoglie le sfide del mese (completate e non). Swipe
// left/right — o le frecce — per passare al mese precedente/successivo.
async function loadSfide(el, meseVoluto) {
  const list = el.querySelector("#sfide-list");

  let sfide;
  try {
    ({ sfide } = await api.get("/sfide?vista=atleta"));
  } catch (err) {
    list.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
    return;
  }

  // Sfide extra (box sotto la card del mese). Se l'endpoint non risponde, il box
  // semplicemente non compare.
  const extraPerMese = new Map();
  try {
    const { sfideExtra } = await api.get("/sfide-extra");
    for (const r of sfideExtra ?? []) {
      const k = `${r.anno}-${String(r.mese).padStart(2, "0")}`;
      if (!extraPerMese.has(k)) extraPerMese.set(k, []);
      extraPerMese.get(k).push(r);
    }
  } catch {
    /* niente box extra */
  }

  // Focus tematico del mese: non è più mostrato in scheda (richiesta di Francesca), ma
  // serve ancora per decidere se anticipare il mese successivo nel carosello.
  // Se l'endpoint non risponde, la scheda funziona lo stesso.
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

  // La stagione va da settembre 2026 a luglio 2027: i mesi fuori da questa finestra non
  // compaiono nel carosello.
  const INIZIO_STAGIONE = "2026-09";
  const FINE_STAGIONE = "2027-07";
  const oggi = new Date().toISOString().slice(0, 10);
  const meseOggi = oggi.slice(0, 7);
  const meseCorrente = meseOggi < INIZIO_STAGIONE ? INIZIO_STAGIONE : meseOggi;

  // Raggruppa per mese di inizio; il mese corrente è sempre presente anche se vuoto.
  const perMese = new Map();
  for (const s of sfide) {
    const key = (s.data_inizio || meseCorrente).slice(0, 7);
    if (key < INIZIO_STAGIONE) continue;
    if (!perMese.has(key)) perMese.set(key, []);
    perMese.get(key).push(s);
  }
  if (!perMese.has(meseCorrente)) perMese.set(meseCorrente, []);

  // Tutti i mesi della stagione compaiono nel carosello, anche prima che la coach inserisca
  // le sfide: i mesi futuri si vedono come anteprima ("5 sfide + coccarda, in arrivo") così
  // gli atleti sanno che ogni mese c'è qualcosa da sbloccare.
  for (let [y, m] = INIZIO_STAGIONE.split("-").map(Number); ; m++) {
    if (m > 12) { m = 1; y++; }
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > FINE_STAGIONE) break;
    if (!perMese.has(key)) perMese.set(key, []);
  }

  // Il prossimo mese ha già il focus tematico (il worker lo anticipa agli atleti): mostralo
  // nel carosello anche se non ha ancora nessuna sfida, così l'anticipazione si vede.
  const [annoC, meseC] = meseCorrente.split("-").map(Number);
  const prossimoKey = meseC === 12 ? `${annoC + 1}-01` : `${annoC}-${String(meseC + 1).padStart(2, "0")}`;
  if (focusPerMese.has(prossimoKey) && !perMese.has(prossimoKey)) perMese.set(prossimoKey, []);

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
          <div class="mese-progress" hidden></div>
        </div>
        <button type="button" class="mese-arrow" data-dir="1" aria-label="Mese successivo">›</button>
      </div>
      <button type="button" class="tendina-btn mese-toggle"></button>
      <div class="mese-viewport"${sfideAperte ? "" : " hidden"}>
        <div class="mese-track" style="padding-top:12px"></div>
      </div>
      <div class="mese-dots" style="display:flex; gap:5px; justify-content:center; margin-top:14px"></div>
    </div>
    <div id="sfide-extra" class="card" hidden></div>
  `;

  const blocco = list.querySelector("#sfide-blocco");
  const titleEl = blocco.querySelector(".mese-title");
  const kickerEl = blocco.querySelector(".mese-kicker");
  const progressEl = blocco.querySelector(".mese-progress");
  const viewport = blocco.querySelector(".mese-viewport");
  const track = blocco.querySelector(".mese-track");
  const dotsBox = blocco.querySelector(".mese-dots");
  const extraBox = list.querySelector("#sfide-extra");
  const toggleBtn = blocco.querySelector(".mese-toggle");

  // Etichetta del bottone tendina in base a stato (aperta/chiusa) e sfide del mese.
  const aggiornaToggle = () => {
    const n = perMese.get(mesi[idx]).length;
    toggleBtn.textContent = sfideAperte
      ? "Chiudi ▴"
      : n
        ? `Vedi ${n === 1 ? "la sfida" : `le ${n} sfide`} ▾`
        : "Vedi il mese ▾";
  };
  const apriChiudi = () => {
    sfideAperte = !sfideAperte;
    viewport.hidden = !sfideAperte;
    aggiornaToggle();
  };
  toggleBtn.addEventListener("click", apriChiudi);
  blocco.querySelector(".mese-head").style.cursor = "pointer";
  blocco.querySelector(".mese-head").addEventListener("click", apriChiudi);

  // Quante "tacche" mostrare nell'anteprima di un mese non ancora inserito.
  const TACCHE_ANTEPRIMA = 5;

  const disegnaMese = () => {
    const key = mesi[idx];
    const items = [...perMese.get(key)].sort((a, b) => (a.data_fine < b.data_fine ? 1 : -1));
    const completate = items.filter((s) => s.partecipato).length;
    const accento = meseAccento(key);
    // Mese futuro ancora senza sfide: anteprima "in arrivo".
    const anteprima = items.length === 0 && key > meseOggi;
    const [annoKey, meseKey] = key.split("-").map(Number);

    blocco.style.setProperty("--mese-accento", accento);
    kickerEl.textContent = `Sfide · ${key.split("-")[0]}`;
    titleEl.textContent = meseNome(key);

    // Una milestone per sfida del mese, piena fino alle completate; a fine barra la
    // medaglia del mese: colorata solo se tutte le sfide del mese sono completate.
    // Nei mesi in anteprima: 5 tacche vuote + coccarda spenta, così si vede la struttura.
    const meseCompleto = items.length > 0 && completate === items.length;
    progressEl.hidden = items.length === 0 && !anteprima;
    progressEl.innerHTML =
      (anteprima
        ? Array.from({ length: TACCHE_ANTEPRIMA }, () => `<span></span>`).join("")
        : items.map((_, i) => `<span class="${i < completate ? "on" : ""}"></span>`).join("")) +
      `<img class="mese-medaglia${meseCompleto ? " on" : ""}" src="/medal-${meseCompleto ? "on" : "off"}.png" alt="" title="${
        meseCompleto ? "Traguardo del mese raggiunto" : "Completa tutte le sfide del mese"
      }" />`;

    track.innerHTML = anteprima
      ? `<p class="mono" style="color:var(--mute); font-size:13px; padding:8px 0; line-height:1.6">
           Sfide in arrivo — si sbloccano il 1° ${MESI[meseKey - 1]} ${annoKey}.<br>
           Ogni mese: 5 sfide da completare e la coccarda del mese da conquistare.
         </p>`
      : items.length
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
    attachMissioni(track, el, () => loadSfide(el, mesi[idx]));
    attachFotoInput(track);
    attachVotazione(track);
    aggiornaToggle();

    const extra = extraPerMese.get(key) ?? [];
    extraBox.hidden = extra.length === 0;
    extraBox.style.setProperty("--mese-accento", accento);
    extraBox.innerHTML = extra.length ? sfideExtraHtml(extra) : "";
    attachFotoInput(extraBox);
    attachPartecipaExtra(extraBox, el, () => loadSfide(el, mesi[idx]));
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
