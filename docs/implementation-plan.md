# Piano di implementazione MVP

## Obiettivo e confini

Un solo codice Ionic/Angular/TypeScript per browser, Android e iOS, con Supabase Auth e PostgreSQL come backend. Il ciclo principale è: il trainer crea il profilo e la disponibilità; il cliente seleziona il trainer, sceglie uno slot e prenota; entrambi vedono la prenotazione. Il database decide se la prenotazione è consentita, anche quando due persone confermano contemporaneamente.

Pagamenti, chat, programmi di allenamento, dati sanitari, recensioni e push non fanno parte dell'MVP. La conferma della prenotazione avviene nell'app. Le integrazioni future potranno usare eventi di prenotazione senza cambiare i controlli di consistenza.

## Architettura

- `src/app/core`: modelli tipizzati, accesso Supabase, sessione, guard e servizi applicativi.
- `src/app/features/auth`: registrazione, login, recupero e aggiornamento password.
- `src/app/features/home`: dashboard distinta per ruolo.
- `src/app/features/booking` e `bookings`: selezione trainer/slot, riepilogo, conferma, dettagli e storico.
- `src/app/features/calendar`, `clients`, `availability`: agenda, elenco clienti e disponibilità trainer.
- `src/app/features/profile`: modifica del proprio profilo.
- `src/app/shared`: componenti e funzioni riutilizzabili.
- `supabase/migrations`: schema, vincoli, funzioni, trigger, indici e RLS versionati.
- `tests` e test vicino ai sorgenti: regole critiche e verifiche d'integrazione.

Angular standalone e lazy loading; TypeScript strict; Signals e servizi per lo stato; componenti Ionic accessibili. Nessuna introduzione di NgRx. Le pagine usano servizi, che chiamano query autorizzate o RPC Supabase. Le credenziali amministrative non entrano nel bundle.

## Schema dati

Tutte le identità sono UUID e le relazioni hanno foreign key. Le tabelle applicabili hanno `created_at` e `updated_at`.

| Tabella | Scopo |
| --- | --- |
| `profiles` | Identità applicativa collegata a `auth.users`, nome, cognome, ruolo, contatti facoltativi, accettazione della privacy |
| `trainer_profiles` | Descrizione pubblica, località, studio, durata sessione, limite cancellazione, timezone IANA |
| `client_profiles` | Estensione del profilo cliente senza dati sanitari |
| `trainer_availability` | Giorno ISO della settimana e una o più fasce di orario locale del trainer |
| `trainer_availability_exceptions` | Intervalli UTC bloccati per assenze, ferie o indisponibilità |
| `bookings` | Trainer, cliente, inizio/fine UTC, stato, nota breve e storico |

Il ruolo singolo vive nel profilo nell'MVP. Una futura tabella di associazione `user_roles` consentirà più ruoli dopo una migrazione esplicita delle policy e dei guard.

Le letture pubbliche dei trainer restituiscono solo una proiezione sicura. Telefono e dati del profilo privato non sono esposti nel catalogo. I trainer accedono ai clienti collegati dalle proprie prenotazioni. Ogni utente modifica solo il proprio profilo e, se trainer, la propria disponibilità.

Le RPC previste sono `list_trainers`, `get_available_slots`, `create_booking`, `cancel_booking`, `get_my_bookings` e `get_trainer_clients`. Le scritture delle prenotazioni passano da funzioni autorizzate; la UI non aggiorna direttamente lo stato.

## Regole e scelte tecniche

- La durata predefinita è 60 minuti; sono previste 30, 45, 60 e 90 minuti.
- Le fasce ricorrenti sono espresse nell'ora locale del trainer; gli appuntamenti usano `timestamptz`.
- La generazione considera disponibilità, eccezioni, prenotazioni e istante corrente.
- Vincoli di esclusione PostgreSQL impediscono sovrapposizioni per trainer e per cliente. Lock transazionali coordinano la prenotazione con le modifiche del calendario.
- Il backend verifica anche l'appartenenza allo slot, la durata, il ruolo e l'identità autenticata.
- Gli appuntamenti sono conservati dopo la cancellazione. Il cliente può cancellare fino al limite configurabile del trainer, inizialmente 12 ore; il trainer può cancellare una propria prenotazione confermata.
- Transizioni previste: `confirmed → cancelled` e `confirmed → completed`. La rappresentazione degli appuntamenti trascorsi è documentata insieme all'implementazione database.
- Date e orari visibili sono localizzati; la scelta del giorno nella prenotazione fa riferimento al calendario del trainer e lo indica chiaramente.
- La privacy e i termini sono segnaposto da far completare prima della distribuzione; non si raccolgono dati sanitari.

## Schermate

Accesso; registrazione con ruolo e consenso obbligatorio; recupero password; nuova password; privacy e termini provvisori; profilo.

Cliente: home con prossimo appuntamento, catalogo trainer e scelta giorno/slot, riepilogo e conferma, prossime prenotazioni, storico e dettaglio con cancellazione.

Trainer: home con prossimo appuntamento e giornata, calendario giornaliero/settimanale, dettaglio prenotazione, clienti, fasce settimanali, assenze e blocchi.

La navigazione inferiore cliente contiene Home, Prenota, Prenotazioni e Profilo; quella trainer Home, Calendario, Clienti e Profilo.

## User stories e accettazione

1. Come trainer mi registro, completo il profilo e imposto lunedì 09:00–13:00.
2. Come cliente mi registro, seleziono il trainer e vedo soltanto gli slot prenotabili: 09:00, 10:00, 11:00 e 12:00, se tutti futuri e liberi.
3. Prenoto 10:00 e ricevo una conferma nell'app con data, orario e trainer.
4. Come trainer vedo l'appuntamento delle 10:00 con il nome del cliente.
5. Come altro cliente non vedo più le 10:00; se confermo uno slot diventato occupato ricevo un messaggio comprensibile.
6. Come cliente vedo prossimi appuntamenti e storico, e posso cancellare solo entro il limite previsto.
7. Come trainer posso consultare la giornata, la settimana, i clienti e bloccare intervalli non prenotati.

## Milestone verificabili

1. Scaffold Ionic/Angular/Capacitor e configurazione ambiente.
2. Supabase locale e configurazione progetto remoto documentata.
3. Schema e policy con test delle autorizzazioni e della concorrenza.
4. Auth e ruoli; poi profili.
5. Disponibilità ed eccezioni; generazione slot.
6. Flusso prenotazione con conferma e gestione conflitto.
7. Dashboard, agenda, elenco clienti, storico e cancellazioni.
8. Test critici, controlli TypeScript/lint/build e verifica end-to-end disponibile nell'ambiente.
9. Configurazione nativa, guida dispositivi e checklist di pubblicazione.

I controlli disponibili vengono rieseguiti ai punti di integrazione; i problemi bloccanti vengono corretti prima della consegna. I controlli Android/iOS che richiedono SDK o hardware assenti sono indicati come non eseguiti, senza sostituirli con una dichiarazione di compatibilità.

## Criticità da verificare

Concorrenza sul medesimo slot; accessi diretti alle tabelle attraverso l'API; transizioni di stato; orari inesistenti o ripetuti durante il cambio dell'ora; conversione del giorno tra timezone differenti; recupero sessione e deep link di recupero password; notifiche di errore senza esposizione di dettagli tecnici.

La build nativa iOS richiede macOS e Xcode. La distribuzione richiede identità definitiva, firma, testi legali reali, dichiarazioni privacy e una soluzione di eliminazione account conforme alle regole degli store. Nessuna pubblicazione automatica è prevista.
