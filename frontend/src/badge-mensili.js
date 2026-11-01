// Badge mensili (Set→Lug della stagione) — card "I tuoi badge" del Profilo e scheda coach.
// Backend: worker/src/lib/badgeMensili.ts -> [{ mese, anno, nome, conquistato, fatte, totali }].
// Immagini: frontend/public/badge/badge_MM.png  (09..12, 01..07), fondo trasparente.
//
// Nella stessa riga vanno anche i trofei "Atleta del mese" vinti (frontend/public/trofei/
// trofeo_MM.png) — restano per sempre nella collezione anche se il mese dopo il titolo
// passa a qualcun altro (richiesta di Francesca 2026-09-16: il trofeo vinto va "salvato" qui,
// non solo mostrato per il mese in corso).
//
// Ogni badge/trofeo è toccabile (richiesta di Francesca, ott 2026): apre un popup col badge
// grande, il mese, il focus e lo stato. Un solo listener globale (sotto) serve tutte le
// pagine che usano badgeMensiliHtml — profilo, scheda pubblica, scheda coach.

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// Focus ufficiali della stagione 2026/27 (documento di Francesca, set 2026): ogni trofeo e
// ogni badge rappresenta il focus del suo mese.
const FOCUS_MESE = {
  9: "Movement Quality & Mobility",
  10: "Stability & Control",
  11: "Strength",
  12: "Strength & Control",
  1: "Power",
  2: "Work Capacity",
  3: "Functional Movement",
  4: "Athletic Movement",
  5: "Engine",
  6: "Functional Performance",
  7: "Performance & Consolidation",
};

const ORO = "#F4B740";
const mm = (mese) => String(mese).padStart(2, "0");
const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function trofeoUrl(mese) {
  return `/trofei/trofeo_${mm(mese)}.png`;
}

const TILE_STYLE =
  "flex:0 0 auto; width:88px; text-align:center; background:none; border:none; padding:0; color:inherit; font:inherit; cursor:pointer";

function badgeTile(b) {
  const sotto = b.conquistato
    ? "✓ completato"
    : b.totali > 0
      ? `${b.fatte}/${b.totali} sfide`
      : "in arrivo";
  return `
    <button type="button" class="badge-tile" style="${TILE_STYLE}"
      data-badge-tipo="badge" data-mese="${b.mese}" data-anno="${b.anno}"
      data-conquistato="${b.conquistato ? 1 : 0}" data-fatte="${b.fatte}" data-totali="${b.totali}"
      aria-label="Badge di ${MESI[b.mese - 1]}">
      <img src="/badge/badge_${mm(b.mese)}.png" alt=""
           style="width:82px; height:82px; object-fit:contain; ${b.conquistato ? "" : "filter:grayscale(1) blur(3px); opacity:0.5"}" />
      <p class="mono" style="font-size:10px; color:${b.conquistato ? "var(--livello-1)" : "var(--mute)"}; margin-top:1px">${sotto}</p>
    </button>`;
}

// `trofei`: [{ mese, anno, punti }] — i mesi in cui questo atleta è stato Atleta del mese.
function trofeoTile(t) {
  const nomeMese = MESI[t.mese - 1];
  return `
    <button type="button" class="badge-tile" style="${TILE_STYLE}"
      data-badge-tipo="trofeo" data-mese="${t.mese}" data-anno="${t.anno}" data-punti="${t.punti}"
      aria-label="Trofeo Atleta del Mese — ${nomeMese}">
      <img src="${trofeoUrl(t.mese)}" alt="" style="width:82px; height:82px; object-fit:contain" />
      <p class="mono" style="font-size:10px; color:${ORO}; margin-top:1px">🏆 ${nomeMese}</p>
    </button>`;
}

// Riga scrollabile degli 11 badge della stagione (spenti finché il mese non è completato)
// + i trofei "Atleta del mese" eventualmente vinti.
export function badgeMensiliHtml(badge, trofei = []) {
  if (!badge?.length && !trofei.length) {
    return `<p class="mono" style="color:var(--mute); font-size:13px">Nessun badge ancora.</p>`;
  }
  return `
    <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px">
      ${trofei.map(trofeoTile).join("")}
      ${(badge ?? []).map(badgeTile).join("")}
    </div>
    <p class="mono" style="color:var(--mute); font-size:11px; margin-top:6px">Si accende quando completi tutte le sfide del mese. Tocca un badge per vederlo.</p>`;
}

// Popup a schermo intero col badge/trofeo in grande. `d` = { tipo: "trofeo"|"badge", mese,
// anno, punti?, conquistato?, fatte?, totali? }.
export function apriDettaglioBadge(d) {
  const nomeMese = maiuscola(MESI[d.mese - 1]);
  const focus = FOCUS_MESE[d.mese] ?? "";
  const trofeo = d.tipo === "trofeo";

  let titolo, img, stato, filtro = "";
  if (trofeo) {
    titolo = "Atleta del Mese";
    img = trofeoUrl(d.mese);
    stato = `<p style="color:${ORO}; font-weight:700; font-size:18px; margin-top:6px">${d.punti} punti</p>
             <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Il più alto punteggio di ${nomeMese.toLowerCase()} ${d.anno}</p>`;
  } else {
    titolo = `Badge di ${nomeMese.toLowerCase()}`;
    img = `/badge/badge_${mm(d.mese)}.png`;
    if (d.conquistato) {
      stato = `<p style="color:var(--livello-1); font-weight:700; font-size:16px; margin-top:6px">✓ Conquistato</p>
               <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Tutte le sfide del mese completate</p>`;
    } else {
      filtro = "filter:grayscale(1) blur(4px); opacity:0.45";
      stato = d.totali > 0
        ? `<p style="font-weight:700; font-size:16px; margin-top:6px">${d.fatte}/${d.totali} sfide</p>
           <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Si accende quando completi tutte le sfide del mese</p>`
        : `<p style="font-weight:700; font-size:16px; margin-top:6px">In arrivo</p>
           <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px">Le sfide si sbloccano il 1° ${nomeMese.toLowerCase()}</p>`;
    }
  }

  const ov = document.createElement("div");
  ov.className = "badge-dettaglio";
  ov.style.cssText =
    "position:fixed; inset:0; z-index:200; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:24px";
  ov.innerHTML = `
    <div role="dialog" aria-modal="true" aria-label="${titolo}"
      style="position:relative; width:100%; max-width:340px; background:var(--surface); border:1px solid var(--border);
             border-radius:18px; padding:28px 20px 22px; text-align:center;
             ${trofeo ? `box-shadow:0 0 60px color-mix(in srgb, ${ORO} 35%, transparent)` : ""}">
      <button type="button" class="badge-dettaglio-chiudi" aria-label="Chiudi"
        style="position:absolute; top:10px; right:12px; border:none; background:none; color:var(--mute); font-size:20px; cursor:pointer">✕</button>
      <p class="kicker" style="color:${trofeo ? ORO : "var(--text)"}">${trofeo ? "🏆 " : ""}${titolo}</p>
      <img src="${img}" alt="" style="width:200px; height:200px; object-fit:contain; margin:14px auto 6px; display:block; ${filtro}" />
      <p style="font-family:var(--font-ui); font-weight:800; font-size:24px; text-transform:uppercase">${nomeMese} ${d.anno}</p>
      ${focus ? `<p class="mono" style="color:var(--mute); font-size:12px; margin-top:2px; text-transform:uppercase; letter-spacing:1px">Focus · ${focus}</p>` : ""}
      ${stato}
    </div>`;
  const chiudi = () => {
    ov.remove();
    document.removeEventListener("keydown", suEsc);
  };
  const suEsc = (e) => e.key === "Escape" && chiudi();
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest(".badge-dettaglio-chiudi")) chiudi();
  });
  document.addEventListener("keydown", suEsc);
  document.body.appendChild(ov);
}

document.addEventListener("click", (e) => {
  const t = e.target.closest?.(".badge-tile");
  if (!t) return;
  const ds = t.dataset;
  apriDettaglioBadge({
    tipo: ds.badgeTipo,
    mese: Number(ds.mese),
    anno: Number(ds.anno),
    punti: Number(ds.punti),
    conquistato: ds.conquistato === "1",
    fatte: Number(ds.fatte),
    totali: Number(ds.totali),
  });
});
