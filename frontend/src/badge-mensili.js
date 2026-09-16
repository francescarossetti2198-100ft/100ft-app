// Badge mensili (Set→Lug della stagione) — card "I tuoi badge" del Profilo e scheda coach.
// Backend: worker/src/lib/badgeMensili.ts -> [{ mese, anno, nome, conquistato, fatte, totali }].
// Immagini: frontend/public/badge/badge_MM.png  (09..12, 01..07), fondo trasparente.
//
// Nella stessa riga vanno anche i trofei "Atleta del mese" vinti (frontend/public/trofei/
// trofeo_MM.png) — restano per sempre nella collezione anche se il mese dopo il titolo
// passa a qualcun altro (richiesta di Francesca 2026-09-16: il trofeo vinto va "salvato" qui,
// non solo mostrato per il mese in corso).

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

function badgeTile(b) {
  const mm = String(b.mese).padStart(2, "0");
  const sotto = b.conquistato
    ? "✓ completato"
    : b.totali > 0
      ? `${b.fatte}/${b.totali} sfide`
      : "in arrivo";
  return `
    <div style="flex:0 0 auto; width:88px; text-align:center">
      <img src="/badge/badge_${mm}.png" alt="Badge ${b.nome}"
           style="width:82px; height:82px; object-fit:contain; ${b.conquistato ? "" : "filter:grayscale(1) blur(3px); opacity:0.5"}" />
      <p class="mono" style="font-size:10px; color:${b.conquistato ? "var(--livello-1)" : "var(--mute)"}; margin-top:1px">${sotto}</p>
    </div>`;
}

// `trofei`: [{ mese, anno, punti }] — i mesi in cui questo atleta è stato Atleta del mese.
function trofeoTile(t) {
  const mm = String(t.mese).padStart(2, "0");
  const nomeMese = MESI[t.mese - 1];
  return `
    <div style="flex:0 0 auto; width:88px; text-align:center">
      <img src="/trofei/trofeo_${mm}.png" alt="Trofeo Atleta del Mese — ${nomeMese}"
           style="width:82px; height:82px; object-fit:contain" />
      <p class="mono" style="font-size:10px; color:#F4B740; margin-top:1px">🏆 ${nomeMese}</p>
    </div>`;
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
    <p class="mono" style="color:var(--mute); font-size:11px; margin-top:6px">Si accende quando completi tutte le sfide del mese.</p>`;
}
