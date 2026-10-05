-- Grafica gia' pronta (scritta + foto + colore, composta dal coach) per una merenda fit.
-- L'app la mostra as-is, senza overlay/impaginazione. Opzionale: una merenda puo' avere
-- solo la grafica, solo il link video, o entrambi.
ALTER TABLE merende_fit ADD COLUMN foto_url TEXT;
