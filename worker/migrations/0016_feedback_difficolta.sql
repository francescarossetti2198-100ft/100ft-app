-- "Come ti è sembrato l'allenamento?" nel feedback post-allenamento: 4 livelli fissi
-- (facile / giusto / impegnativo / tostissimo), tenuti come testo. Sostituisce nel flusso
-- peso_parte_alta / peso_parte_bassa (le colonne peso restano per i feedback già inviati,
-- non vengono più scritte).
ALTER TABLE feedback_allenamento ADD COLUMN difficolta TEXT;
