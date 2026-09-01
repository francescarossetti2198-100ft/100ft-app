// Foto sfide/Daily Drop su R2 (brief, sezioni 8 e 10). Restituisce un path servito da
// GET /api/foto/:prefisso/:file (vedi routes/foto.ts), non un URL R2 diretto (il bucket
// non è pubblico).
export async function salvaFoto(bucket: R2Bucket, prefisso: string, file: File): Promise<string> {
  const estensione = file.type === "image/png" ? "png" : "jpg";
  const chiave = `${prefisso}/${crypto.randomUUID()}.${estensione}`;
  await bucket.put(chiave, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || "image/jpeg" } });
  return `/api/foto/${chiave}`;
}

// Documenti (PDF / Word) allegati al diario allenamenti. Serviti dalla stessa rotta
// GET /api/foto/:prefisso/:file — con Content-Disposition così il download conserva il nome.
const ESTENSIONI_DOC: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function salvaFile(
  bucket: R2Bucket,
  prefisso: string,
  file: File
): Promise<{ url: string; nome: string }> {
  const nome = file.name || "documento";
  const estensione = nome.split(".").pop()?.toLowerCase() ?? "";
  if (!ESTENSIONI_DOC[estensione]) {
    throw new Error("Sono ammessi solo file PDF o Word (.pdf, .doc, .docx)");
  }
  const chiave = `${prefisso}/${crypto.randomUUID()}.${estensione}`;
  const nomeSicuro = nome.replace(/[\r\n"]/g, "_");
  await bucket.put(chiave, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || ESTENSIONI_DOC[estensione],
      contentDisposition: `inline; filename="${nomeSicuro}"`,
    },
  });
  return { url: `/api/foto/${chiave}`, nome };
}

// Cancella dal bucket la foto puntata da un path `/api/foto/<chiave>` (best-effort: se
// fallisce, la vecchia foto resta orfana ma non è un errore per l'utente). Usata quando
// l'atleta sostituisce la foto profilo, per non accumulare file inutilizzati su R2.
export async function eliminaFoto(bucket: R2Bucket, path: string | null | undefined): Promise<void> {
  const m = path?.match(/^\/api\/foto\/(.+)$/);
  if (!m) return;
  try {
    await bucket.delete(m[1]);
  } catch {
    /* best-effort */
  }
}
