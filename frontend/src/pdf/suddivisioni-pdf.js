// Resoconto abbonamenti in PDF da consegnare alla palestra: un mese, solo gli iscritti
// che hanno pagato, raggruppati per abbonamento con la ripartizione coach / palestra.
// jsPDF è importato qui (import dinamico dal chiamante) così resta fuori dal bundle principale.

const MESI_DEFAULT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const eur = (n) => (Number.isInteger(n) ? `${n} EUR` : `${n.toFixed(2)} EUR`);

export async function scaricaSuddivisioniPdf(dati, mesi = MESI_DEFAULT) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginX = 48;
  const larghezza = doc.internal.pageSize.getWidth() - marginX * 2;
  const fondo = doc.internal.pageSize.getHeight() - 56;
  let y = 60;

  const nuovaPaginaSeServe = (h) => {
    if (y + h > fondo) {
      doc.addPage();
      y = 60;
    }
  };

  const nomeMese = mesi[dati.mese - 1] ?? String(dati.mese);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("100FT — Resoconto abbonamenti", marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`${nomeMese} ${dati.anno} · solo iscritti che hanno pagato`, marginX, y);
  doc.setTextColor(0);
  y += 24;

  // Paganti raggruppati per abbonamento (dalle righe complete).
  const gruppi = new Map();
  for (const r of dati.righe) {
    if (!r.pagato) continue;
    const k = r.nomePiano ?? r.piano;
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(r);
  }

  if (gruppi.size === 0) {
    doc.text("Nessun pagamento registrato per questo mese.", marginX, y);
    doc.save(`suddivisioni-${dati.anno}-${dati.mese}.pdf`);
    return;
  }

  for (const [nomeP, righe] of gruppi) {
    nuovaPaginaSeServe(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const prezzo = righe[0]?.prezzo ?? 0;
    doc.text(`${nomeP}  ·  ${eur(prezzo)}/mese`, marginX, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let subIncasso = 0;
    let subCoach = 0;
    let subPalestra = 0;
    let subDaDefinire = 0;

    for (const r of righe) {
      nuovaPaginaSeServe(16);
      const quote =
        r.quotaCoach != null
          ? `a te ${eur(r.quotaCoach)} · palestra ${eur(r.quotaPalestra)}`
          : "ripartizione da definire";
      doc.text(r.nome, marginX + 8, y);
      doc.text(`${eur(r.prezzo)}   (${quote})`, marginX + larghezza, y, { align: "right" });
      y += 15;
      subIncasso += r.prezzo;
      if (r.quotaCoach != null) {
        subCoach += r.quotaCoach;
        subPalestra += r.quotaPalestra ?? 0;
      } else {
        subDaDefinire += r.prezzo;
      }
    }

    nuovaPaginaSeServe(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const parti = [
      `${righe.length} iscritt${righe.length === 1 ? "o" : "i"}`,
      `incassato ${eur(subIncasso)}`,
      `a te ${eur(subCoach)}`,
      `palestra ${eur(subPalestra)}`,
    ];
    if (subDaDefinire) parti.push(`da definire ${eur(subDaDefinire)}`);
    doc.text(parti.join("  ·  "), marginX + 8, y);
    y += 24;
    doc.setFont("helvetica", "normal");
  }

  // Totale generale.
  nuovaPaginaSeServe(50);
  doc.setDrawColor(180);
  doc.line(marginX, y, marginX + larghezza, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Totale del mese", marginX, y);
  y += 16;
  doc.setFontSize(11);
  doc.text(`A te: ${eur(dati.totali.coach)}`, marginX + 8, y);
  y += 15;
  doc.text(`Alla palestra: ${eur(dati.totali.palestra)}`, marginX + 8, y);
  if (dati.totali.daDefinire) {
    y += 15;
    doc.text(`Da definire: ${eur(dati.totali.daDefinire)}`, marginX + 8, y);
  }

  doc.save(`suddivisioni-${dati.anno}-${dati.mese}.pdf`);
}
