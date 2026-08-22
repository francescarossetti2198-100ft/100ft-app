// Foto sfide/Daily Drop su R2 (brief, sezioni 8 e 10). Restituisce un path servito da
// GET /api/foto/:prefisso/:file (vedi routes/foto.ts), non un URL R2 diretto (il bucket
// non è pubblico).
export async function salvaFoto(bucket: R2Bucket, prefisso: string, file: File): Promise<string> {
  const estensione = file.type === "image/png" ? "png" : "jpg";
  const chiave = `${prefisso}/${crypto.randomUUID()}.${estensione}`;
  await bucket.put(chiave, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || "image/jpeg" } });
  return `/api/foto/${chiave}`;
}
