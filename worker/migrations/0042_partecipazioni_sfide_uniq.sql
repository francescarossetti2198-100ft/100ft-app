-- Un atleta partecipa a una sfida una volta sola. Senza questo vincolo, due chiamate
-- concorrenti di verificaTraguardi (la Home carica /profilo/me più volte in parallelo)
-- inserivano due righe → punti e post nel Feed doppi (successo il 9 set con la sfida
-- "Fai almeno un daily drop"). I doppioni sono già stati ripuliti a mano.
CREATE UNIQUE INDEX idx_partecipazioni_uniq ON partecipazioni_sfide(sfida_id, user_id);
