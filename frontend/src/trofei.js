// Presentazione dei trofei di stagione (2 per stagione: Set–Dic, Gen–Lug).
// Backend: worker/src/lib/trofei.ts -> { blocco, stagione, etichetta, conquistato, fatte, totale }.
// L'emoji 🏆 è un segnaposto: la struttura è pronta per un'immagine dedicata.

function emojiStyle(conquistato) {
  return conquistato
    ? "font-size:34px; line-height:1; text-shadow:0 0 10px rgba(244,183,64,0.55)"
    : "font-size:34px; line-height:1; filter:grayscale(1); opacity:0.35";
}

// Un trofeo come tessera (card "I TUOI TROFEI" del profilo, scheda coach).
export function trofeoCardHtml(t) {
  const sotto = t.conquistato
    ? "Conquistato"
    : t.totale > 0
      ? `${t.fatte}/${t.totale} sfide`
      : "Nessuna sfida ancora";
  return `
    <div style="flex:1; min-width:0; text-align:center; padding:12px 6px; border:1px solid var(--border); border-radius:12px">
      <div style="${emojiStyle(t.conquistato)}">🏆</div>
      <p style="font-weight:700; font-size:14px; margin-top:6px">${t.etichetta}</p>
      <p class="mono" style="color:${t.conquistato ? "var(--livello-1)" : "var(--mute)"}; font-size:11px; margin-top:2px">${sotto}</p>
    </div>`;
}

// I 2 trofei affiancati.
export function trofeiRigaHtml(trofei) {
  if (!trofei?.length) return `<p class="mono" style="color:var(--mute); font-size:13px">Nessun trofeo ancora.</p>`;
  return `<div style="display:flex; gap:10px">${trofei.map(trofeoCardHtml).join("")}</div>`;
}
