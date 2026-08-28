-- Pesi usati (parte alta/bassa) nel feedback post-allenamento — TEXT per ammettere sia i
-- valori della lista fissa sia un valore libero scelto con "Altro".
ALTER TABLE feedback_allenamento ADD COLUMN peso_parte_alta TEXT;
ALTER TABLE feedback_allenamento ADD COLUMN peso_parte_bassa TEXT;
