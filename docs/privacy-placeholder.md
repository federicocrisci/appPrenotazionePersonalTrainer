# Documenti legali: segnaposto di sviluppo

Questo file non costituisce un'informativa privacy né un contratto pronto all'uso. I testi provvisori nelle pagine Privacy e Termini devono essere sostituiti e verificati prima di raccogliere dati di utenti reali o inviare l'app agli store.

## Informativa Privacy — DA REDIGERE

Definire almeno titolare e recapiti, finalità e base giuridica di ciascun trattamento, dati effettivamente trattati, fornitori e regione dei servizi, trasferimenti internazionali eventuali, tempi di conservazione, diritti e modalità di esercizio, cancellazione/esportazione, gestione dei minori se applicabile e autorità di controllo competente.

L'MVP tratta identità dell'account, email tramite Supabase Auth, ruolo, profilo, telefono e foto facoltativi, disponibilità, eccezioni e prenotazioni. Non richiede dati sanitari o medici. Le note sono brevi: spiegare che non vanno usate per informazioni sensibili.

La registrazione registra l'accettazione della versione provvisoria dell'informativa solo come meccanismo tecnico di sviluppo. La checkbox “Ho letto e accetto l'Informativa Privacy” richiesta dal prodotto non determina da sola la base giuridica corretta di ogni trattamento. Prima del lancio far valutare formulazione, basi giuridiche e necessità di consensi separati.

## Termini e Condizioni — DA REDIGERE

Definire soggetto che eroga il servizio, requisiti d'accesso, responsabilità di clienti e trainer, funzionamento delle prenotazioni, cancellazioni, assistenza, gestione degli account, limiti del servizio e legge/foro applicabili secondo il contesto effettivo. Non introdurre clausole definitive tramite questi esempi tecnici.

## Misure tecniche dell'MVP

Profili privati protetti da RLS; proiezione limitata dei trainer; prenotazioni visibili ai partecipanti; nessuna credenziale amministrativa nel frontend; controlli delle prenotazioni nel database. Queste misure sostengono la minimizzazione e non equivalgono a una certificazione di conformità GDPR.

## Funzioni future da completare prima della distribuzione

Eliminazione account con verifica dell'identità e conservazione motivata dello storico; esportazione dei dati; procedure di gestione diritti e incidenti; documentazione dei fornitori; versionamento definitivo dei documenti legali; URL pubblici di privacy, termini e supporto. Consultare la [checklist pubblicazione](publication-checklist.md).
