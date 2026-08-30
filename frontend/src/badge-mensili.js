// Badge mensili (Set→Lug della stagione) — card "I tuoi badge" del Profilo e scheda coach.
// Backend: worker/src/lib/badgeMensili.ts -> [{ mese, anno, nome, conquistato, fatte, totali }].
// Immagini: frontend/public/badge/badge_MM.png  (09..12, 01..07), fondo trasparente.

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
           style="width:82px; height:82px; object-fit:contain; ${b.conquistato ? "" : "filter:grayscale(1); opacity:0.38"}" />
      <p class="mono" style="font-size:10px; color:${b.conquistato ? "var(--livello-1)" : "var(--mute)"}; margin-top:1px">${sotto}</p>
    </div>`;
}

// Riga scrollabile degli 11 badge della stagione (spenti finché il mese non è completato).
export function badgeMensiliHtml(badge) {
  if (!badge?.length) {
    return `<p class="mono" style="color:var(--mute); font-size:13px">Nessun badge ancora.</p>`;
  }
  return `
    <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px">
      ${badge.map(badgeTile).join("")}
    </div>
    <p class="mono" style="color:var(--mute); font-size:11px; margin-top:6px">Si accende quando completi tutte le sfide del mese.</p>`;
}
