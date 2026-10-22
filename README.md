# PT Booking

Applicazione MVP per Personal Trainer e clienti, con un solo frontend Ionic/Angular per browser, Android e iOS. Supabase gestisce account, database PostgreSQL e autorizzazioni. Le prenotazioni vengono validate nel database: un vincolo transazionale impedisce che due clienti occupino contemporaneamente lo stesso intervallo.

Il progetto contiene codice applicativo, migration SQL, test, configurazione Capacitor e guide per il collaudo. Per usare un backend personale occorre creare un progetto Supabase e configurare le variabili come descritto sotto. Non vengono pubblicate automaticamente app o infrastrutture.

## Cosa comprende l'MVP

- Registrazione cliente/trainer, login, logout, recupero password e gestione della sessione.
- Profili separati per ruolo, consenso alla privacy e contatti facoltativi.
- Disponibilità settimanali con più fasce al giorno ed eccezioni per ferie/assenze.
- Slot calcolati in base a disponibilità, durata, prenotazioni, blocchi e ora corrente.
- Selezione trainer/giorno/orario, riepilogo e conferma nell'app.
- Dashboard cliente e trainer, agenda giornaliera/settimanale, elenco clienti e storico.
- Cancellazione con limite configurabile, inizialmente 12 ore per il cliente.
- RLS, funzioni SQL autorizzate e vincoli contro sovrapposizioni di trainer e cliente.

Non sono inclusi pagamenti, abbonamenti, chat, allenamenti, dati sanitari, recensioni o push. Le email di conferma account/recupero sono quelle di Supabase Auth; la conferma di una prenotazione è mostrata nell'app, non inviata automaticamente via email.

Le pagine legali sono **segnaposto di sviluppo**. Eliminazione account ed esportazione non hanno ancora un flusso prodotto completo. Completare questi punti, i testi legali e i controlli di produzione prima di una distribuzione pubblica: vedere [checklist pubblicazione](docs/publication-checklist.md).

## 1. Prerequisiti

Per il browser servono:

1. Un computer Windows, macOS o Linux.
2. Git, per scaricare e aggiornare il progetto.
3. Node.js **22.12 o superiore della serie 22**, oppure una versione compatibile con `package.json` (`>=22.12 <25`). Node 22 LTS è la scelta più semplice.
4. Un account Supabase, oppure Docker per eseguire Supabase sul proprio computer.
5. Un editor di testo, ad esempio Visual Studio Code.

Per Android servono anche Android Studio e i componenti SDK richiesti dal progetto Android. Per iOS servono **un Mac con Xcode** e un iPhone o simulatore. Windows e Linux non possono compilare la versione iOS con Xcode.

Aprire un terminale: Terminale su macOS/Linux, PowerShell su Windows, oppure il terminale integrato di Visual Studio Code. I comandi successivi vanno eseguiti dalla cartella del progetto, dove si trova `package.json`.

## 2. Installare Node e scaricare il progetto

### Installazione semplice

1. Visitare [nodejs.org](https://nodejs.org/), scaricare Node 22 LTS e seguire il programma di installazione.
2. Chiudere e riaprire il terminale.
3. Eseguire:

```sh
node --version
npm --version
```

Il primo comando deve mostrare una versione compatibile, per esempio `v22.x.x`. Se compare “comando non trovato”, riavviare il terminale e controllare che Node sia stato aggiunto al PATH dall'installer.

Chi usa già `nvm` può entrare nella cartella del progetto ed eseguire `nvm install` e `nvm use`: il file `.nvmrc` indica Node 22. Non occorre installare un secondo gestore se si usa l'installer.

### Scaricare

```sh
git clone https://github.com/federicocrisci/appPrenotazionePersonalTrainer.git
cd appPrenotazionePersonalTrainer
npm ci
```

`npm ci` installa le versioni definite da `package-lock.json`. Non cambiare il lockfile per risolvere un errore di configurazione.

L'Ionic CLI non è necessaria per i comandi di questo README. Per usarla senza installazione globale:

```sh
npx @ionic/cli --version
```

In alternativa `npm install -g @ionic/cli` rende disponibile il comando `ionic`. Angular, Capacitor e Supabase CLI sono già dipendenze del progetto e si eseguono con `npx`.

## 3. Scegliere il backend

Scegliere **una** delle due modalità:

- **Progetto Supabase ospitato:** consigliato per provare l'app su un telefono senza configurare la rete locale. Seguire le sezioni 4–7.
- **Supabase locale con Docker:** consigliato per sviluppo e test automatici. Seguire la sezione 8, poi avviare l'app.

Non eseguire reset, seed o test distruttivi su un database di produzione.

## 4. Creare un progetto Supabase ospitato

1. Accedere a [supabase.com/dashboard](https://supabase.com/dashboard) e scegliere **New project**.
2. Selezionare o creare l'organizzazione e assegnare un nome, per esempio `pt-booking-dev`.
3. Scegliere una password database robusta e conservarla in un password manager. Non inserirla nel codice e non condividerla in chat.
4. Per utenti europei valutare una regione UE. La scelta della regione non sostituisce la valutazione privacy.
5. Attendere che il progetto sia attivo.
6. Nelle impostazioni del progetto cercare **API Keys** e **Data API**: annotare il **Project URL** (`https://…supabase.co`) e la chiave **publishable** oppure la vecchia chiave **anon**.
7. Non usare le chiavi `secret`/`service_role` nel frontend. Consentono privilegi amministrativi e non devono essere distribuite nell'app.

Le etichette del dashboard possono variare; i valori cercati sono URL del progetto e chiave pubblica utilizzabile da client con RLS.

## 5. Configurare `.env`

Copiare `.env.example` e chiamare la copia `.env` nella stessa cartella di `package.json`.

macOS/Linux:

```sh
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Aprire `.env` con l'editor e compilare:

```dotenv
SUPABASE_URL=https://IL_TUO_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=LA_TUA_CHIAVE_PUBLISHABLE_O_ANON
AUTH_REDIRECT_URL=http://localhost:4200/auth/callback
CAPACITOR_APP_ID=com.example.ptbooking
CAPACITOR_APP_NAME=PT Booking
```

Non includere le parole di esempio come valori reali. Non aggiungere una service-role key al posto di `SUPABASE_ANON_KEY`.

| Variabile | Uso |
| --- | --- |
| `SUPABASE_URL` | Endpoint HTTPS del progetto; entra nella configurazione client |
| `SUPABASE_ANON_KEY` | Chiave pubblica publishable/anon; RLS protegge i dati |
| `AUTH_REDIRECT_URL` | URL di ritorno conferma/recupero; per browser è il callback locale, per l'app installata è il deep link |
| `CAPACITOR_APP_ID` | Identificatore iniziale nativo; temporaneamente `com.example.ptbooking` |
| `CAPACITOR_APP_NAME` | Nome dell'app usato nella configurazione Capacitor |
| `SUPABASE_SERVICE_ROLE_KEY` | Facoltativa, solo per script amministrativi di sviluppo; mai nel bundle |
| `DEMO_PASSWORD` | Facoltativa, password scelta localmente per il seed demo; mai versionata |
| `DATABASE_URL` | Solo per test database su un'istanza locale sacrificabile |

`.env` è ignorato da Git. Se una chiave amministrativa viene pubblicata per errore, revocarla/ruotarla: rimuoverla da un commit successivo non basta.

`npm start`, `npm run build` e `npm run typecheck` generano `src/environments/environment.ts` a partire dalle sole impostazioni pubbliche. Il file generato è ignorato e non va modificato a mano. Dopo ogni modifica a `.env`, riavviare il server web o ricostruire e sincronizzare l'app nativa.

## 6. Creare il database con le migration

Tabelle, indici, trigger, funzioni, vincoli e policy RLS sono versionati in `supabase/migrations`. Non occorre creare tabelle o policy a mano.

### Metodo consigliato: Supabase CLI

Dalla cartella del progetto:

```sh
npx supabase login
npx supabase link --project-ref IL_TUO_PROJECT_REF
npx supabase db push
```

1. `login` apre l'accesso Supabase. Usare il flusso ufficiale; non incollare token nel codice.
2. Il project ref è la parte identificativa dell'URL del progetto, visibile anche nelle impostazioni. Sostituire `IL_TUO_PROJECT_REF` senza parentesi.
3. `link` può chiedere la password database impostata alla creazione del progetto.
4. `db push` elenca le migration da applicare: verificare che il progetto collegato sia quello di sviluppo prima di confermare.

Le migration già applicate non vanno eseguite di nuovo manualmente. Per modifiche successive creare una nuova migration, senza cambiare la storia di un progetto già in uso.

### Alternativa: SQL Editor, solo per una nuova installazione

Se non si usa la CLI:

1. Aprire **SQL Editor** nel dashboard del progetto corretto.
2. Aprire nell'editor locale i file `.sql` di `supabase/migrations` in ordine alfabetico.
3. Copiare il contenuto completo del primo file in una nuova query SQL ed eseguirlo.
4. Ripetere per ogni file successivo e conservare un registro dei file applicati.
5. Verificare che non ci siano errori. Non eseguire pezzi selezionati in ordine casuale.

Questa alternativa non aggiorna automaticamente la cronologia migration della CLI: prima di passare in seguito a `db push`, seguire la documentazione Supabase per allineare la cronologia, invece di rieseguire lo schema. Non eseguire `supabase/seed.sql` o script demo in produzione.

Per comprendere controlli, funzioni e timezone vedere [database e sicurezza](docs/database.md).

## 7. Configurare Supabase Authentication

Nel dashboard aprire **Authentication**.

1. In **Providers / Sign In**, abilitare **Email** con email e password. Impostare una lunghezza minima di 12 caratteri e richiedere maiuscole, minuscole e numeri, coerentemente con i moduli dell’app e con la configurazione locale.
2. In **URL Configuration**, impostare **Site URL** a `http://localhost:4200` per il browser di sviluppo.
3. Aggiungere alle **Redirect URLs** gli URL effettivamente usati:

```text
http://localhost:4200/auth/callback
ptbooking://auth/callback
```

4. Se si usa una porta o un dominio diverso, aggiungere anche quel callback preciso. Per la produzione usare il proprio URL HTTPS e redirect restrittivi.
5. Per un progetto reale mantenere attiva la conferma email. Nell'ambiente locale può essere disabilitata per i test automatizzati; verificare comunque il flusso di conferma prima della release.
6. Per inviare email a utenti reali configurare un servizio SMTP in **Authentication / Email / SMTP**. Il servizio predefinito di sviluppo può avere limiti e restrizioni sui destinatari; un invio bloccato non si risolve disabilitando i controlli dell'app.
7. Verificare template di conferma e recupero in modo che mantengano i link generati da Supabase; non rimuovere il parametro di ritorno previsto.

La registrazione invia nome, cognome, ruolo e accettazione della privacy come metadata. Un trigger crea i profili: non creare le righe a mano dopo ogni registrazione. Il ruolo non si cambia liberamente dal client.

### Recupero password

Nella pagina di accesso selezionare il recupero, inserire l'email e aprire il link ricevuto. Usare la stessa piattaforma prevista da `AUTH_REDIRECT_URL`: browser per `http://localhost:4200/auth/callback`, app installata per `ptbooking://auth/callback`.

Prima della build nativa impostare:

```dotenv
AUTH_REDIRECT_URL=ptbooking://auth/callback
```

Poi eseguire la build e la sincronizzazione Capacitor. Lo schema `ptbooking` è già registrato in `android/app/src/main/AndroidManifest.xml` e in `ios/App/App/Info.plist`; il callback deve essere consentito anche in Supabase. Se si cambia lo schema, aggiornare tutti e tre i punti. Tornando a sviluppare nel browser ripristinare il callback HTTP e riavviare il server.

## 8. Supabase locale con Docker

1. Installare e avviare [Docker Desktop](https://www.docker.com/products/docker-desktop/) o un Docker Engine compatibile.
2. Verificare che `docker info` funzioni senza errori.
3. Dalla cartella del progetto eseguire:

```sh
npm run db:start
npm run db:reset
```

Il primo avvio scarica le immagini e può richiedere tempo. I comandi locali passano dal wrapper `scripts/supabase.mjs`, che usa le immagini **slim supportate dalla CLI Supabase** per ridurre lo spazio richiesto e conserva la configurazione CLI in un percorso del progetto ignorato da Git. La CLI risolve le immagini slim ufficiali su GHCR con digest verificati; Docker Hub è configurato per le immagini standard di supporto. L’avvio termina soltanto dopo i controlli HTTP Auth/REST e PostgreSQL/migration di `scripts/check-readiness.mjs`; i dettagli della sonda di salute in ambienti con proxy sono nel [rapporto di verifica](docs/validation-report.md). `db:reset` **cancella e ricrea il database locale** applicando migration e seed locale: non eseguirlo se contiene dati che si vogliono conservare.

Il comando di avvio esclude servizi non necessari a questo MVP, come Studio, Storage, Realtime e funzioni Edge. Auth e API PostgreSQL rimangono attivi. Foto tramite URL facoltativo non richiedono Storage nell'MVP.

Creare automaticamente un `.env` locale contenente **solo URL API, chiave pubblica e callback**:

```sh
npm run db:configure
```

Il comando legge lo stato locale senza mostrare né salvare chiavi amministrative. Rifiuta di sovrascrivere un `.env` già presente: conservarlo prima con un altro nome ignorato, ad esempio `.env.hosted.local`, se si vuole passare dal backend ospitato a quello locale. Non eliminare una configurazione personale per far proseguire lo script.

Normalmente l'API locale è `http://127.0.0.1:54321`. Lo script ricava i valori dalla propria istanza; non presume chiavi uguali tra macchine. Il comando Supabase `status`, se usato manualmente per diagnosi, può mostrare credenziali locali: non pubblicarne l'output. Le utility incluse evitano di stamparle.

Le email locali di sviluppo si consultano nel servizio di posta locale, configurato sulla porta 54324. Nessuna email demo deve arrivare a utenti reali. La configurazione locale disabilita la conferma email per rendere ripetibili i test; sul progetto ospitato abilitarla e collaudarla prima della release.

Per fermare i servizi senza eliminare volutamente i dati:

```sh
npm run db:stop
```

I processi non sopravvivono necessariamente a un riavvio dell'ambiente cloud: eseguire di nuovo `npm run db:start` prima di usare l'app.

### Dati demo

Lo script è destinato **soltanto al backend Supabase locale**, non a un progetto ospitato. Crea un trainer e tre clienti, disponibilità e prenotazioni future/storiche. Le credenziali non sono incluse nel repository: aggiungere nel proprio `.env` soltanto la password scelta per gli account di prova:

```dotenv
DEMO_PASSWORD=UNA_PASSWORD_LUNGA_SCELTA_DA_TE
```

Usare almeno 12 caratteri, incluse maiuscole, minuscole e numeri. Non copiare il segnaposto come password reale. Poi:

```sh
npm run demo:seed
```

Non occorre compilare `DATABASE_URL` o una service-role key: lo script ricava e usa le credenziali della sola istanza locale nei processi necessari, senza salvarle nel bundle o mostrarle.

Gli indirizzi demo sono `trainer.demo@example.test` e `client1.demo@example.test`, `client2.demo@example.test`, `client3.demo@example.test`. Accedere con la password scelta; questi indirizzi non ricevono email reali. Il seed amministrativo conferma gli account demo per consentire le prove locali. Prepara fasce lunedì–venerdì 09:00–13:00 e 15:00–19:00, appuntamenti futuri, un'assenza e uno storico.

**Ogni esecuzione elimina e ricrea soltanto questi quattro account demo, insieme ai loro dati collegati.** Non usare mai tali indirizzi per utenti reali o informazioni da conservare. Il resto dell'istanza non è un bersaglio del seed, ma è comunque prudente riservare il backend locale a dati di collaudo.

Lo storico viene importato tramite una connessione amministrativa locale in una transazione: le normali API dell'app continuano a vietare prenotazioni nel passato. Non usare lo script su produzione e non distribuire gli account demo in una release pubblica.

## 9. Avviare nel browser

Dopo configurazione e migration:

```sh
npm start
```

Aprire `http://localhost:4200` nel browser del proprio computer. Questo indirizzo serve per sviluppo locale; non è un link pubblico all'app.

Per vedere l'interfaccia mobile usare la modalità dispositivo degli strumenti sviluppatore. Il test nel browser non sostituisce il collaudo su Android/iOS.

Se manca la configurazione Supabase, l'app deve mostrare un'indicazione di configurazione: non finge di aver creato utenti o prenotazioni. Dopo aver compilato `.env`, interrompere il server con `Ctrl+C` e riavviarlo.

## 10. Verifiche automatiche

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

- `lint`: controlli statici del codice.
- `typecheck`: TypeScript e template Angular.
- `test`: test unitari delle parti critiche.
- `build`: compilazione web usata poi da Capacitor.

I test database richiedono il backend locale avviato e migrato. Il wrapper legge le credenziali locali e le passa soltanto ai processi di test; non serve copiarle in `.env`:

```sh
npm run check:local -- test:db
npm run check:local -- test:auth
```

`test:db` verifica vincoli, autorizzazioni, disponibilità, cancellazione, timezone e tentativi concorrenti su PostgreSQL reale. `test:auth` verifica registrazione/ruoli, login, logout, privacy dei profili e recupero password attraverso le API Auth reali. I test creano fixture temporanee e le eliminano; non eseguirli su produzione.

Per il flusso browser installare Chromium di Playwright e avviare il test:

```sh
npx playwright install chromium
npm run check:local -- test:e2e
```

Playwright avvia il server Angular sulla porta 4200 e usa un viewport mobile. Chiudere eventuali server sulla stessa porta che usino una configurazione diversa, per evitare il riutilizzo di un'app collegata a un altro backend. Il report e gli eventuali screenshot/tracce sono output locali ignorati da Git; trattarli con cautela se contengono dati di test.

In ambienti che forniscono già Chromium si può indicare `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; ad esempio su questa macchina Linux il percorso può essere `/usr/bin/chromium`. È un'alternativa facoltativa: sul proprio computer il comando `playwright install chromium` è normalmente più semplice.

I comandi diretti `npm run test:db` e `npm run test:auth` richiedono invece variabili di connessione già impostate e sono destinati a esecuzioni controllate. Un test saltato perché mancano le credenziali non è un test superato. Per l'ambiente locale usare il wrapper sopra.

È predisposto anche il workflow `.github/workflows/ci.yml` per lint, typecheck, test unitari, backend locale, integrazione Auth/database, browser e build. Non è stato eseguito su GitHub durante questa implementazione. I risultati delle prove svolte qui, distinti dai controlli ancora da eseguire, sono nel [rapporto di verifica](docs/validation-report.md).

Per il collaudo completo sui telefoni seguire [test manuali Android/iOS](docs/mobile-testing.md).

## 11. Preparare Android

### Installare gli strumenti

1. Installare Android Studio dal sito ufficiale [developer.android.com/studio](https://developer.android.com/studio).
2. Aprirlo e completare la configurazione iniziale con Android SDK, Platform Tools e Build Tools richiesti dal progetto.
3. Il progetto Capacitor 8 usa **JDK 21**, Android **min SDK 24** e **compile/target SDK 36** (vedere `android/variables.gradle`). Installare la piattaforma Android SDK 36 tramite SDK Manager e selezionare JDK 21 nelle impostazioni Gradle di Android Studio. Non cambiare le versioni per aggirare un errore senza verificarne la compatibilità.
4. Se si usa un emulatore, aprire Device Manager, creare un dispositivo virtuale con un'immagine recente e avviarlo.

### Compilare e aprire

Configurare prima `.env` con il progetto Supabase HTTPS raggiungibile dal telefono e il callback nativo. Poi:

```sh
npm run native:android
```

Questo comando ricostruisce il frontend, sincronizza Capacitor e apre Android Studio. Il progetto nativo è in `android/`.

In Android Studio:

1. Attendere il completamento della sincronizzazione Gradle e l'eventuale download SDK.
2. Selezionare un emulatore o un telefono dall'elenco dei dispositivi.
3. Premere **Run** (triangolo verde).
4. Attendere compilazione e installazione: l'app si apre sul dispositivo.

### Installare su un telefono Android

1. Sul telefono aprire Impostazioni → Informazioni sul telefono e toccare più volte **Numero build** per abilitare le opzioni sviluppatore, se non già attive.
2. Nelle Opzioni sviluppatore abilitare **Debug USB**.
3. Collegare il telefono al computer e accettare la richiesta di autorizzazione del computer sul telefono.
4. Se Windows non lo rileva, installare il driver USB del produttore.
5. Selezionare il telefono in Android Studio e premere Run.

Per un APK debug: Android Studio → **Build → Build Bundle(s) / APK(s) → Build APK(s)**. L'APK debug non è un pacchetto di pubblicazione Play Store. Installazioni manuali possono richiedere di autorizzare l'installazione da quella sorgente.

### Backend locale dal telefono

`localhost` o `127.0.0.1` sul telefono indica il telefono stesso. L'emulatore Android può raggiungere il computer con `10.0.2.2`; un telefono reale richiede un endpoint raggiungibile e una configurazione di rete sicura. Per iniziare è più semplice usare il progetto Supabase ospitato HTTPS. Non disabilitare TLS per rendere funzionante una release.

## 12. Preparare iOS e installare su iPhone

Questi passaggi richiedono macOS.

1. Installare una versione di Xcode compatibile con Capacitor 8 dal Mac App Store e avviarla almeno una volta per accettare la licenza/installare componenti. Controllare i [requisiti ufficiali Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup) quando si aggiorna il progetto. Il deployment target del progetto generato è **iOS 15**.
2. In Xcode → Settings → Accounts aggiungere il proprio Apple ID. Per distribuzione e TestFlight serve l'Apple Developer Program.
3. Verificare gli strumenti CLI con `xcode-select -p`; se necessario selezionare Xcode dalle impostazioni o tramite `xcode-select` secondo la documentazione Apple.
4. Configurare `.env` con Supabase HTTPS e `AUTH_REDIRECT_URL=ptbooking://auth/callback`.
5. Eseguire:

```sh
npm run native:ios
```

6. In Xcode selezionare il progetto **App**, poi il target **App** → **Signing & Capabilities**.
7. Selezionare il proprio **Team** e attivare la gestione automatica della firma, se appropriato.
8. Verificare il Bundle Identifier; se `com.example.ptbooking` non è disponibile per il proprio Team, scegliere l'identificatore definitivo e mantenerlo coerente con la configurazione del progetto.
9. Per il simulatore scegliere un iPhone simulato e premere Run.
10. Per un iPhone reale collegarlo al Mac, autorizzare il computer e selezionarlo come destinazione.
11. Abilitare Developer Mode sul telefono se iOS lo richiede, quindi premere Run. Seguire gli eventuali avvisi di attendibilità del profilo sviluppatore.

Un account Apple personale può avere limiti di installazione e validità della firma. Per una prova più stabile o per altri tester usare TestFlight tramite un account Developer appropriato.

Il progetto iOS incluso usa **Swift Package Manager**, configurato in `ios/App/CapApp-SPM/Package.swift`: lasciare che Xcode risolva i pacchetti. Non installare CocoaPods a meno che una futura dipendenza lo richieda. `cap sync` non compila l'app iOS e non equivale a una prova su iPhone.

## 13. Nome, identificatore, icona e splash

La configurazione iniziale è in `capacitor.config.ts`, con variabili `CAPACITOR_APP_ID` e `CAPACITOR_APP_NAME`. Il valore temporaneo è `com.example.ptbooking`.

**Attenzione:** cambiare `CAPACITOR_APP_ID` dopo la generazione dei progetti non rinomina automaticamente i file nativi. Prima della pubblicazione aggiornare e verificare anche:

- Android: `applicationId`/namespace in `android/app/build.gradle`, package e percorso della MainActivity e qualsiasi riferimento al vecchio ID.
- iOS: Bundle Identifier in Xcode per ogni configurazione/target pertinente e impostazioni di firma.
- Link, servizi e dashboard associati al vecchio identificatore.

Se il progetto nativo non contiene personalizzazioni, un'alternativa è archiviarlo e rigenerarlo con `npx cap add android` o `npx cap add ios` dopo aver impostato l'identità definitiva. Non eliminare personalizzazioni o file di firma senza un backup.

I progetti includono risorse reali di icona e splash generate dal template Capacitor, ma sono **segnaposto grafici**, senza identità definitiva. Android usa le risorse in `android/app/src/main/res/`; iOS usa gli asset in `ios/App/App/Assets.xcassets/`. Per una release sostituirle con gli asset definitivi oppure preparare i sorgenti previsti da `@capacitor/assets` e usare il suo generatore. Non è già presente un set personalizzato di asset sorgenti per quel comando. Controllare poi visivamente icone e splash in Android Studio/Xcode e su dispositivo.

Dopo ogni modifica al frontend:

```sh
npm run native:sync
```

Rieseguire Run dall'IDE nativo per installare la versione aggiornata.

## 14. Regole di prenotazione e decisioni MVP

- Un utente ha un solo ruolo; una migrazione futura potrà introdurre un'associazione multi-ruolo.
- La disponibilità settimanale usa il calendario e la timezone IANA del trainer. Una fascia non attraversa la mezzanotte: dividere il lavoro in due fasce su giorni diversi.
- Gli appuntamenti sono istanti UTC (`timestamptz`) e vengono mostrati nella timezone locale del dispositivo. La selezione del giorno di prenotazione fa riferimento al trainer.
- Le durate supportate sono 30/45/60/90 minuti, predefinita 60.
- Il backend controlla slot, orario futuro, blocchi, ruoli, durata e sovrapposizioni. Il client non può creare una prenotazione per un altro cliente.
- Le prenotazioni non vengono eliminate fisicamente dall'interfaccia; la cancellazione conserva lo storico.
- Il limite di cancellazione del cliente si configura nel profilo trainer; predefinito 12 ore, intervallo ammesso 0–168 ore. Si usa la regola attuale del trainer al momento della cancellazione. Il controllo definitivo è nel database.
- Per evitare un job obbligatorio nell’MVP, `get_my_bookings()` restituisce come `completed` gli appuntamenti confermati il cui orario di fine è trascorso; la riga può restare `confirmed` fisicamente. Il trainer può ancora cancellare una riga persistita `confirmed`; un job privilegiato futuro può persistere il completamento.
- Nei cambi dell’ora vengono esclusi gli orari locali inesistenti e gli slot con durata reale diversa da quella configurata. Per l’ora ripetuta autunnale PostgreSQL sceglie l’occorrenza in ora standard, documentata e verificata nei test.
- Le modifiche alle fasce ricorrenti agiscono sulla disponibilità libera futura e non cancellano appuntamenti già confermati. Un blocco sovrapposto a una prenotazione richiede di gestire prima quella prenotazione.

Per la semantica precisa di completamento, DST, concorrenza e privilegi vedere [documentazione database](docs/database.md). Non introdurre aggiornamenti diretti delle prenotazioni per aggirare le RPC.

## 15. Troubleshooting

| Sintomo | Controlli e soluzione |
| --- | --- |
| `npm`/`node` non riconosciuto | Reinstallare Node compatibile, riaprire il terminale, verificare PATH e `node --version`. |
| Installazione dipendenze fallisce | Verificare versione Node, spazio e accesso a registry.npmjs.org. Usare `npm ci`; leggere l'errore senza disabilitare TLS o controlli d'integrità. |
| Porta 4200 occupata | Arrestare il server precedente o usare `npm start -- --port 4201`; aggiornare callback `.env` e Redirect URLs Supabase. |
| App dice che manca la configurazione | Controllare che il file si chiami davvero `.env`, non `.env.txt`, e sia accanto a `package.json`; riavviare `npm start`. |
| `Invalid API key` o errore di rete | Verificare coppia URL/chiave pubblica dello stesso progetto, stato progetto e connettività. Non sostituire la chiave con `service_role`. |
| Registrazione non completa il profilo | Verificare che tutte le migration siano applicate e metadata/consenso validi. Controllare log Auth/database sul progetto di sviluppo. |
| Email di conferma/recupero non arriva | Controllare spam, rate limit e configurazione SMTP; gli indirizzi demo `.test` non ricevono email reali. |
| Link torna al sito sbagliato | Allineare `AUTH_REDIRECT_URL`, Site URL, Redirect URLs e piattaforma. Ricostruire/sincronizzare l'app dopo le modifiche. |
| Nessuno slot disponibile | Verificare giorno nel calendario del trainer, fasce, timezone, durata, blocchi e prenotazioni già presenti. Gli orari passati sono esclusi. |
| Slot appena occupato | È una situazione attesa di concorrenza: aggiornare e scegliere un altro orario. Non riprovare creando righe direttamente. |
| Cancellazione rifiutata | Controllare ruolo, appartenenza, stato e limite orario del trainer. L'orologio del database è autorevole. |
| Supabase locale non parte | Verificare Docker avviato, spazio, immagini scaricabili e porte 54321/54322 libere. Leggere i log del servizio fallito prima di riprovare. |
| Test database richiede `DATABASE_URL` | Avviare il backend locale e usare `npm run check:local -- test:db`; il wrapper passa la connessione al processo senza salvarla. |
| Telefono non raggiunge backend locale | Non usare localhost del computer nel telefono; preferire Supabase HTTPS ospitato o configurare correttamente la rete di sviluppo. |
| Android Gradle/SDK fallisce | Aprire Android Studio, installare SDK richiesti e selezionare JDK compatibile; attendere Gradle sync e controllare il primo errore reale. |
| iOS firma non valida | In Xcode verificare Team, Bundle Identifier, dispositivo registrato e certificati; un comando web non può risolvere credenziali Apple mancanti. |
| App nativa mostra codice vecchio | Eseguire `npm run native:sync`, poi ricompilare/reinstallare dall'IDE. |

Non condividere log contenenti token, chiavi, password o dati personali. La UI mostra messaggi comprensibili; per la diagnosi usare i log di sviluppo e del progetto Supabase con accesso autorizzato.

## 16. Struttura e approfondimenti

```text
src/app/core/              modelli, auth, servizi, guard
src/app/features/          schermate per funzionalità
src/app/shared/            componenti e funzioni comuni
supabase/migrations/       schema e sicurezza versionati
supabase/seed.sql          seed locale sicuro / istruzioni fixture
scripts/                  configurazione e strumenti di sviluppo
tests/                    integrazione database/Auth e browser
android/                  progetto Capacitor Android
ios/                      progetto Capacitor iOS
docs/                     architettura, collaudo, pubblicazione
```

- [Piano e architettura](docs/implementation-plan.md)
- [Database, autorizzazioni e concorrenza](docs/database.md)
- [Rapporto delle verifiche eseguite](docs/validation-report.md)
- [Checklist Android/iOS](docs/mobile-testing.md)
- [Checklist Google Play e App Store](docs/publication-checklist.md)
- [Privacy e termini da completare](docs/privacy-placeholder.md)

## Evoluzioni previste

Le conferme passano dall'esito verificato delle RPC e dalla UI. Per aggiungere push in futuro creare una coda/outbox transazionale di eventi (`booking_confirmed`, `booking_cancelled`), gestirla tramite worker/Edge Function e memorizzare i token dispositivo in una tabella protetta per proprietario. Inviare solo dopo il commit e rendere il consumo idempotente. Reminder richiedono un job schedulato e gestione di timezone/cancellazioni; non sono attivi nell'MVP.

Prima di introdurre pagamenti, programmi, salute, multi-ruolo o nuovi canali di notifica, aggiornare schema, policy, test e documentazione privacy. Non usare le note delle prenotazioni come sostituto di funzionalità che richiedono un trattamento diverso dei dati.
