# 100FT — Abbonamenti e costi

Riepilogo dei piani di abbonamento proposti da 100FT e dei relativi costi.
Fonte di verità nel codice: `frontend/src/abbonamenti.js` + `worker/src/lib/abbonamentiPiani.ts`
(da tenere in sync). I prezzi sono **mensili** e si vedono **solo lato coach**, mai nell'app
dell'atleta.

## Contesto

100FT — Functional Training, Centocelle. Allenamento funzionale in piccolo gruppo con la coach.
Giorni base della settimana:

- **Lun · Mer · Ven** — allenamento funzionale
- **Mar** — core & stretching

Il martedì e il "corso fitness in palestra" del piano MIX **non** sono sessioni tracciate
dall'app 100FT (che resta su Lun/Mer/Ven): contano solo ai fini dell'abbonamento.

## Piani

| Abbonamento | Cosa comprende | Prezzo |
|---|---|---|
| **FULL** | Lun · Mar · Mer · Ven (tutti i giorni) | **60 €/mese** |
| **TRIO** | Lun · Mer · Ven — il classico, 3 volte a settimana | **50 €/mese** |
| **SOLO** | 1 giorno a settimana a scelta | **30 €/mese** |
| **MIX** | 1 allenamento funzionale + Mar + 1 corso fitness in palestra a scelta | **50 €/mese** |
| **FITNESSDREAM** | Lun · Mer · Ven — riservato a chi ha già un abbonamento attivo ai corsi della palestra FitnessDream | **30 €/mese** |

## Regole

- La scelta del piano nell'app vale ogni mese senza fare niente.
- Se l'atleta cambia piano, il nuovo vale **dal mese successivo**; il mese in corso resta
  com'era. La primissima scelta è invece **immediata**.
- **FITNESSDREAM** è disponibile solo per chi è già iscritto ai corsi della palestra
  FitnessDream.
- Anelli, livelli e obiettivi in app sono **uguali per tutti** (base Lun/Mer/Ven):
  l'abbonamento è solo fatturazione, non cambia gli obiettivi.
- Il pagamento del mese lo segna manualmente il coach dalla scheda dell'atleta. Se al
  **secondo lunedì del mese** non risulta ancora pagato, l'atleta riceve una notifica push
  di promemoria ("Ricordati di saldare il tuo abbonamento mensile").
