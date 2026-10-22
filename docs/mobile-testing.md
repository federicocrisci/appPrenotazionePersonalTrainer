# Checklist manuale Android e iOS

Questa checklist serve su un dispositivo reale Android e su un iPhone, oltre ai test automatici. Segnare data, versione, sistema operativo e risultato effettivo. Una build web o `cap sync` riuscito non prova che l'app nativa funzioni.

Usare un progetto Supabase di sviluppo e account di prova. Non inserire dati sanitari, numeri di telefono reali o altre informazioni personali non necessarie. Preparare un trainer e almeno tre clienti, tutti con email confermata se il progetto richiede la conferma. Il seed locale elimina e ricrea i soli quattro account demo a ogni esecuzione: non usare quegli indirizzi per dati da conservare.

## Installazione e configurazione

- [ ] Android: compilare con Android Studio/JDK 21 e SDK 36, installare e aprire l’app su dispositivo Android 7/API 24 o successivo.
- [ ] iOS: compilare su macOS con Xcode compatibile con Capacitor 8, configurare Team e firma, installare su iPhone iOS 15 o successivo.
- [ ] Verificare nome, icona provvisoria, splash screen, versione e orientamento.
- [ ] Controllare che l'URL Supabase sia raggiungibile dal dispositivo; `127.0.0.1` nel telefono indica il telefono, non il computer.
- [ ] Verificare che nessuna service-role key sia presente negli asset o nel codice distribuito.
- [ ] Ruotare lo schermo e controllare che moduli e pulsanti restino utilizzabili.
- [ ] Provare tastiera virtuale, aree sicure, barra di stato e tasto Indietro Android.

## Autenticazione

- [ ] Registrarsi come trainer con nome/cognome/email/password e consenso obbligatorio.
- [ ] Senza consenso, con email non valida o password troppo breve, il modulo non deve essere inviato.
- [ ] Se la conferma email è abilitata, l'app spiega che occorre confermare l'indirizzo.
- [ ] Aprire il link di conferma sul dispositivo e verificare il ritorno corretto.
- [ ] Uscire e rientrare; con password errata appare un errore comprensibile.
- [ ] Chiudere e riaprire l'app: il ripristino della sessione non mostra pagine di un altro ruolo.
- [ ] Recuperare la password; il link apre la schermata corretta e permette di impostarne una nuova.
- [ ] Dopo il recupero, la nuova password consente l'accesso e quella precedente non funziona.
- [ ] Simulare sessione scaduta o revocata: l'app riporta all'accesso o offre un nuovo accesso senza mostrare dati protetti.
- [ ] Collegamenti diretti a pagine trainer da account cliente e viceversa sono respinti dai guard; l'API respinge comunque l'operazione.

## Profili e disponibilità

- [ ] Modificare il proprio profilo, chiudere e riaprire l'app e verificare i valori salvati.
- [ ] I dati facoltativi possono restare vuoti; il ruolo non si può cambiare modificando il profilo.
- [ ] Impostare lunedì 09:00–13:00 e 15:00–19:00, durata 60 minuti.
- [ ] Aggiungere, modificare ed eliminare una fascia; un intervallo con fine precedente all'inizio è respinto.
- [ ] Impostare un giorno non disponibile e verificare che non produca slot.
- [ ] Inserire un'assenza per un giorno intero e un blocco di alcune ore; verificare le rispettive esclusioni.
- [ ] Tentare un blocco su una prenotazione confermata: l'app spiega l'eventuale vincolo e non nasconde l'appuntamento esistente.
- [ ] Modificare la disponibilità ricorrente e verificare che gli appuntamenti già confermati restino visibili.

## Flusso completo richiesto

- [ ] Trainer: creare account, accedere, completare profilo, impostare lunedì 09:00–13:00, uscire.
- [ ] Cliente 1: creare account, accedere, selezionare il trainer e un lunedì futuro.
- [ ] Vedere 09:00, 10:00, 11:00, 12:00 se liberi e senza eccezioni.
- [ ] Scegliere 10:00, controllare il riepilogo, confermare e leggere il messaggio di conferma.
- [ ] Nelle prenotazioni appare trainer, data, inizio/fine e stato corretti.
- [ ] Trainer: rientrare e verificare l'appuntamento delle 10:00 e il nome del cliente in home/agenda.
- [ ] Cliente 2: aprire lo stesso giorno e verificare che le 10:00 non siano disponibili.
- [ ] Usare due dispositivi o sessioni indipendenti per visualizzare contemporaneamente uno stesso slot libero: confermare quasi insieme. Soltanto una prenotazione deve riuscire; l'altra sessione mostra “Questo orario è stato appena prenotato. Seleziona un altro orario.” o messaggio equivalente.
- [ ] Provare a prenotare due trainer diversi nello stesso intervallo con il medesimo cliente: l'API impedisce la sovrapposizione.
- [ ] Dopo il conflitto aggiornare l'elenco e selezionare un altro slot.

## Agenda, storico e cancellazioni

- [ ] Trainer: confrontare viste giornaliera e settimanale, appuntamenti, slot liberi e blocchi.
- [ ] Aprire il dettaglio: nome, data, durata, note e stato corrispondono.
- [ ] L'elenco clienti contiene solo chi ha prenotato con quel trainer, con conteggio e prossimo appuntamento coerenti.
- [ ] Cliente: le prenotazioni future e lo storico sono distinti e ordinati in modo comprensibile.
- [ ] Annullare una prenotazione oltre il limite: serve conferma e lo stato diventa `cancelled` senza cancellare la riga.
- [ ] Tentare la cancellazione meno di 12 ore prima, o del valore configurato: viene impedita anche dall'API.
- [ ] Trainer: cancellare un proprio appuntamento confermato e verificare l'aggiornamento per il cliente.
- [ ] Un utente non può cancellare una prenotazione altrui neppure cambiando l'ID della richiesta.
- [ ] Gli appuntamenti trascorsi seguono la regola di completamento documentata; non è possibile riportarli arbitrariamente a `confirmed`.

## Timezone e cambio dell'ora

- [ ] Con trainer `Europe/Rome`, verificare un giorno invernale e uno estivo: gli orari locali ricorrenti restano gli stessi e l'offset UTC cambia correttamente.
- [ ] Provare la domenica di passaggio all'ora legale: nessuno slot deve essere creato in un orario locale inesistente.
- [ ] Provare la domenica di ritorno all'ora solare: verificare la scelta documentata per gli orari ambigui e l'assenza di doppie prenotazioni.
- [ ] Cambiare timezone del dispositivo, ad esempio `America/New_York`: appuntamenti e riepilogo rappresentano lo stesso istante; la selezione del giorno indica il calendario del trainer.
- [ ] Provare prenotazioni vicino a mezzanotte e a fine mese/anno; nessuno slittamento involontario del giorno.

## Rete, accessibilità e privacy

- [ ] Modalità aereo prima e durante il caricamento: stato di errore e possibilità di riprovare, senza conferma fittizia.
- [ ] Perdita di rete mentre si conferma: aggiornare le prenotazioni prima di riprovare; non devono apparire duplicati.
- [ ] Connessione lenta/timeout: spinner e pulsanti disabilitati durante l'invio; nessun caricamento infinito.
- [ ] Catalogo senza trainer, giorno senza slot, storico vuoto e agenda vuota hanno messaggi utili.
- [ ] Con VoiceOver/TalkBack, i campi hanno label e i pulsanti nomi comprensibili.
- [ ] Aumentare dimensione testo e controllare contrasto, touch target e scorrimento.
- [ ] La UI non mostra query SQL, stack trace, token o dettagli di errori tecnici.
- [ ] I profili di altri clienti e le prenotazioni di terzi non sono accessibili tramite richieste dirette.
- [ ] Privacy e termini sono chiaramente provvisori nella build di sviluppo; sostituirli prima di una release.

## Scheda risultato

| Campo | Valore |
| --- | --- |
| Data e tester | |
| Commit/versione/build | |
| Dispositivo e sistema operativo | |
| Progetto Supabase di prova | |
| Test superati/falliti/non eseguiti | |
| Problemi riproducibili e passaggi | |
