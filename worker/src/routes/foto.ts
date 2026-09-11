import { Hono } from "hono";
import type { Env, SessionUser } from "../types";

type Variables = { user: SessionUser };
const foto = new Hono<{ Bindings: Env; Variables: Variables }>();

// Media servite da R2 (foto profilo, foto sfide/Daily Drop, allegati del diario). NON
// protette da `requireAuth`: sono già mostrate a tutto il gruppo (feed, classifica, schede
// pubbliche) e la chiave è un UUID non indovinabile. Soprattutto: un <img src> cross-origin
// da app.100-ft.com verso api.100-ft.com non porta con sé il cookie di sessione su alcuni
// browser (Safari/iOS in PWA), quindi con requireAuth le foto sparivano.
foto.get("/:prefisso/:file", async (c) => {
  const chiave = `${c.req.param("prefisso")}/${c.req.param("file")}`;
  const oggetto = await c.env.FOTO_SFIDE.get(chiave);
  if (!oggetto) return c.notFound();

  const headers: Record<string, string> = {
    "Content-Type": oggetto.httpMetadata?.contentType ?? "image/jpeg",
    // Le chiavi sono immutabili (UUID): la cache può tenerle a lungo.
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  // Documenti (diario allenamenti): Content-Disposition col nome originale → il download
  // salva "scheda-lunedi.pdf" invece dell'UUID interno.
  if (oggetto.httpMetadata?.contentDisposition) {
    headers["Content-Disposition"] = oggetto.httpMetadata.contentDisposition;
  }
  return new Response(oggetto.body, { headers });
});

export default foto;
