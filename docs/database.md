# Database e sicurezza

Lo schema completo è in `supabase/migrations/202610220001_core.sql`. La migration
si applica con il normale workflow Supabase CLI (`supabase db reset` in locale,
`supabase db push` per un progetto remoto collegato). Non modificare tabelle o
policy manualmente nel Dashboard: aggiungere una nuova migration versionata.

## Modello

| Tabella | Scopo | Lettura dall'app | Scrittura dall'app |
| --- | --- | --- | --- |
| `profiles` | Nome, cognome, ruolo immutabile, telefono/foto facoltativi, consenso | Solo il proprietario | Solo campi del proprio profilo; ruolo e consenso immutabili |
| `trainer_profiles` | Descrizione, località, studio, durata, regola cancellazione, timezone | Solo il proprietario | Solo il proprietario |
| `client_profiles` | Estensione del profilo cliente | Solo il proprietario | Creato dal trigger di registrazione |
| `trainer_availability` | Fasce settimanali, giorno ISO 1=lunedì … 7=domenica | Solo il trainer proprietario | Solo il trainer proprietario |
| `trainer_availability_exceptions` | Intervalli UTC bloccati, motivo facoltativo | Solo il trainer proprietario | Solo il trainer proprietario |
| `bookings` | Appuntamenti e storico | Solo i due partecipanti | Esclusivamente RPC autorizzate |

Tutte le tabelle hanno PK UUID, FK, timestamp e RLS. Indici sugli appuntamenti per
trainer/data e cliente/data, sulle eccezioni e sugli intervalli rendono efficienti
le ricerche dell'agenda. I campi testuali hanno limiti database. La directory dei
trainer e l'elenco clienti sono proiezioni esplicite: non espongono email,
telefono, metadati di autenticazione o consensi.

### Registrazione

Supabase Auth crea l'utente. Il trigger transazionale `private.handle_new_user`
richiede i metadati `first_name`, `last_name`, `role` (`trainer` o `client`) e
`privacy_accepted: true`; registra l'istante del consenso dal server e la
`privacy_version` fornita (default `draft-v1`). Crea anche il profilo specifico
del ruolo. Un errore annulla l'intera registrazione, evitando utenti incompleti.

Il ruolo non deriva da dati modificabili nei JWT per autorizzare le prenotazioni:
le RPC controllano i profili database. Modificare `raw_user_meta_data` dopo il
signup non cambia il ruolo assegnato. L'MVP consente un ruolo per account; per il
futuro, introdurre `user_roles(user_id, role)` e adattare autorizzazioni/guard con
una migration, senza modificare gli UUID dei profili o degli appuntamenti.

## API RPC

Tutte le funzioni pubbliche richiedono un utente autenticato. `anon` non ha
accesso. Le funzioni `SECURITY DEFINER` hanno `search_path` vuoto e riferimenti
qualificati; i relativi helper sono in uno schema privato non accessibile
all'app. L'app usa soltanto la chiave pubblica/publishable, mai `service_role`.

| Funzione | Contratto |
| --- | --- |
| `list_trainers()` | Directory con `user_id`, nome/cognome/foto, descrizione, località, studio, durata, timezone e ore limite cancellazione |
| `get_available_slots(p_trainer_id uuid, p_date date)` | `{ starts_at, ends_at }` per una **data nel fuso del trainer**; accesso cliente o trainer stesso |
| `create_booking(p_trainer_id uuid, p_starts_at timestamptz, p_notes text = null)` | Prenota per `auth.uid()` verificando che sia un cliente; restituisce la riga creata |
| `cancel_booking(p_booking_id uuid)` | Controlla proprietario, ruolo, stato e scadenza; restituisce la riga cancellata logicamente |
| `get_my_bookings()` | Appuntamenti del chiamante con `trainer_name`, `client_name`, `cancellation_hours`, `trainer_timezone` e stato effettivo |
| `get_trainer_clients()` | Solo trainer: clienti con almeno una prenotazione, prossimo appuntamento e totale sessioni non cancellate |

L'app legge e modifica le proprie disponibilità/eccezioni direttamente con RLS.
Il cliente vede la disponibilità tramite gli slot generati, senza leggere motivi
di assenze, ferie o prenotazioni di altre persone.

### Errori applicativi

Le RPC restituiscono `P0001` con codici stabili nel messaggio:

- `SLOT_UNAVAILABLE`: slot passato, non previsto, bloccato o appena occupato.
- `BOOKING_CUTOFF`: cancellazione del cliente oltre il limite configurato.
- `NOT_AUTHORIZED`: operazione/risorsa non accessibile al chiamante.
- `BOOKING_NOT_CANCELLABLE`: stato finale o transizione non consentita.
- `AVAILABILITY_CONFLICT`: un blocco interferirebbe con un appuntamento esistente.
- `INVALID_INPUT` / `INVALID_SIGNUP_METADATA`: dati non validi.

Le fasce settimanali sovrapposte violano il vincolo `23P01`; campi fuori limite
possono produrre `23514`. La UI traduce questi codici in messaggi comprensibili e
non mostra i dettagli SQL. I vincoli GiST delle prenotazioni vengono tradotti in
`SLOT_UNAVAILABLE` dalla RPC.

## Coerenza, concorrenza e disponibilità

La UI non decide se una prenotazione è valida. In un'unica transazione il server:

1. verifica che il chiamante sia cliente;
2. prende un lock transazionale per trainer e cliente;
3. recupera durata e timezone attuali del trainer;
4. accetta solo l'inizio esatto di uno slot generato dalla fascia settimanale;
5. verifica futuro, durata e assenza di blocchi;
6. inserisce l'appuntamento protetto da due vincoli di esclusione GiST.

I controlli sul passato e sul termine di cancellazione usano l'ora effettiva del
server **dopo** l'attesa sui lock, evitando che una richiesta iniziata prima della
scadenza ma sbloccata successivamente aggiri la regola.

`tstzrange(starts_at, ends_at, '[)')` consente appuntamenti consecutivi: uno può
finire esattamente quando il successivo inizia. Non possono sovrapporsi né gli
appuntamenti di un trainer, né quelli di un cliente con trainer diversi. I
vincoli includono gli stati `confirmed` e `completed`; `cancelled` libera lo
slot. Il controllo rimane valido anche in caso di richieste simultanee e di
inserimenti da backend fidati. Il trigger database rifiuta anche inserimenti
nel passato o con stato iniziale diverso da `confirmed`.

Modifiche a fasce, eccezioni e impostazioni del trainer usano lo stesso lock
transazionale. Un'eccezione che copre appuntamenti non cancellati è rifiutata:
cancellare prima gli appuntamenti interessati. Modificare durata, fuso o fasce
settimanali influenza gli **slot futuri liberi**; gli appuntamenti già confermati
mantengono durata e istanti originali. Per segnare un giorno della settimana
come non disponibile, eliminare le relative fasce. Per una data specifica,
inserire un'eccezione da mezzanotte a mezzanotte successiva nel fuso del trainer.

## Stati e cancellazione

Le sole transizioni persistenti sono `confirmed → cancelled` e
`confirmed → completed`. Identità dei partecipanti, orari, note e data creazione
sono immutabili dopo l'inserimento. Nessuna API pubblica permette di cancellare
fisicamente appuntamenti. Una transizione da stato finale è rifiutata.

Per evitare dipendenze da cron, `get_my_bookings()` proietta gli appuntamenti
`confirmed` già terminati come `completed`. La riga può rimanere `confirmed` nel
database; questo è deliberato. Una futura elaborazione server può persistere
`completed` dopo `ends_at` usando un job privilegiato; il trigger lo consente
soltanto a sessione terminata. La UI e i conteggi dello storico usano la RPC.

Il cliente può cancellare solo un appuntamento futuro con preavviso almeno pari
alle `cancellation_hours` attuali del trainer (default 12, configurabile 0–168).
Il limite esatto è incluso. Cambiare la regola si applica anche alle
prenotazioni esistenti: è una decisione dell'MVP da comunicare ai clienti. Il
trainer può cancellare una riga persistita `confirmed` anche dopo il suo inizio,
senza limite di preavviso. Gli stati finali rimangono finali.

## Timezone e ora legale

- Disponibilità settimanale: ora locale nel fuso IANA del trainer, ad esempio
  `Europe/Rome`.
- Prenotazioni ed eccezioni: `timestamptz`, rappresentate come istanti UTC.
- `p_date` degli slot: data civile del trainer, non data UTC né data del cliente.
- Presentazione appuntamenti: fuso del dispositivo; la schermata di scelta
  giorno indica il fuso del trainer.

Gli slot sono generati nel calendario locale del trainer e convertiti in UTC.
In primavera gli orari inesistenti sono omessi tramite un controllo di
conversione di andata/ritorno. In autunno PostgreSQL sceglie deterministicamente
l'occorrenza con ora standard di un orario ambiguo: non si mostrano due slot con
la stessa etichetta locale. Un candidato il cui intervallo attraversa il cambio
dell'ora ed ha durata reale diversa dalla durata della sessione viene omesso.
Ogni slot mostrato conserva quindi esattamente 30/45/60/90 minuti reali. Non si
usano offset fissi come `UTC+1` e non si aggiungono 24 ore per ottenere il giorno
successivo di un calendario locale.

## Test e dati demo

`tests/database.integration.mjs` esegue test contro un database **locale
disponibile e migrato** usando `DATABASE_URL`, `pg` e `node:test`. Usa utenti
casuali e pulisce i propri dati. Verifica RLS, metadati signup, fasce, blocchi,
orari arbitrari/passati, due prenotazioni simultanee, sovrapposizioni del cliente,
cancellazioni e DST. Non eseguire contro produzione.

`supabase/seed.sql` non contiene account né credenziali fisse. Seguire lo script
demo descritto nel README per creare account Auth tramite variabili locali.
Eventuali dati storici di demo richiedono il percorso esplicito di seed locale:
le normali API non permettono di inserire appuntamenti passati.

## Privacy ed evoluzioni

Nessuna tabella raccoglie informazioni sanitarie. Non inserire dati sensibili
nelle note. Informativa e termini sono placeholder da sostituire prima di
acquisire utenti reali; `draft-v1` non equivale a una policy validata legalmente.
Telefono e foto sono facoltativi. L'email rimane in Supabase Auth e non viene
duplicata nelle directory.

La cancellazione logica di una prenotazione conserva lo storico. La cancellazione
di un account attraverso un futuro flusso backend privilegiato farà invece
cascadere i suoi dati relazionali: definire prima una politica di conservazione
e, se serve mantenere statistiche/storico dell'altra parte, introdurre
anonimizzazione con una migration. Export/eliminazione account e retention vanno
implementati prima di una distribuzione pubblica che li richieda. Non esporre
mai la chiave `service_role` al browser o all'app mobile.

Per push/reminder futuri aggiungere un outbox transazionale e token dispositivo
protetti da RLS. Un worker/Edge Function privilegiato può inviare eventi senza
toccare i vincoli di prenotazione; non chiamare provider push direttamente dalla
transazione SQL.
