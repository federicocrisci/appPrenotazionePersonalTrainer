# Preparazione alla pubblicazione

Nessuno script di questo progetto pubblica automaticamente sugli store. Il pacchetto usa inizialmente `com.example.ptbooking`: sostituirlo con un identificatore definitivo prima di creare le schede store e le credenziali di firma.

La configurazione nativa e i segnaposto grafici costituiscono una base di sviluppo. Non dichiarano che l'app abbia superato la revisione Apple/Google o che sia pronta a ricevere utenti reali.

## Prerequisiti comuni

- [ ] Scegliere nome definitivo, titolare dell'app, contatto di supporto e categoria.
- [ ] Scegliere bundle/application ID definitivo e verificare che sia uguale nei progetti nativi, nel backend e nei link configurati. `capacitor.config.ts` da solo non rinomina un progetto nativo già generato.
- [ ] Preparare icona definitiva, splash, screenshots reali per le dimensioni richieste e descrizione comprensibile.
- [ ] Preparare URL HTTPS pubblici per privacy policy, termini e supporto. Fare redigere testi adeguati al trattamento reale; rimuovere tutti i segnaposto.
- [ ] Definire titolare, finalità, base giuridica, conservazione, fornitori/sub-responsabili e gestione dei diritti. Valutare regione Supabase UE e accordi sul trattamento.
- [ ] Implementare ed esporre il percorso di richiesta/eliminazione account richiesto dagli store, con verifica dell'identità e trattamento coerente dello storico. L'MVP non include ancora questa funzione.
- [ ] Definire procedura di esportazione dei dati e gestione delle richieste di accesso/cancellazione. Un link a un segnaposto non soddisfa questi obblighi.
- [ ] Rivedere note libere e campi profilo per evitare la raccolta di dati sanitari; informare gli utenti di non inserirli.
- [ ] Abilitare e verificare RLS sul progetto di produzione, applicare le migration e usare solo chiavi pubbliche nel client.
- [ ] Non distribuire account demo, password demo, credenziali amministrative o dati di sviluppo in produzione.
- [ ] Configurare URL di conferma/recupero Auth, SMTP di produzione, rate limit e deliverability email.
- [ ] Verificare backup, monitoraggio errori senza dati personali superflui e procedura di ripristino.
- [ ] Verificare i manifest delle dipendenze, permessi realmente usati e dichiarazioni privacy richieste dalle versioni SDK correnti.
- [ ] Completare la [checklist dispositivi](mobile-testing.md), inclusi concorrenza e cambio dell'ora.

## Google Play Store

- [ ] Creare/verificare l'account Google Play Console e gli eventuali requisiti di identità/organizzazione.
- [ ] Impostare `applicationId` definitivo, `versionName` e `versionCode` crescente in `android/app/build.gradle`.
- [ ] Configurare firma release con keystore custodito fuori dal repository e Play App Signing. Conservare le credenziali di recupero in modo sicuro.
- [ ] Verificare target/min SDK e requisiti Google Play vigenti al momento dell'invio.
- [ ] Generare un Android App Bundle release con Android Studio; non caricare l'APK debug.
- [ ] Completare scheda store: nome, descrizione breve/estesa, categoria, icona, feature graphic, screenshots, email e URL supporto/privacy.
- [ ] Compilare Data safety in base al comportamento reale dell'app e dei servizi: account, email, nome, contatti opzionali, disponibilità e prenotazioni. Controllare raccolta, condivisione, cifratura e cancellazione senza presumere che “uso Supabase” basti come risposta.
- [ ] Fornire il collegamento web per la richiesta di eliminazione account e il percorso nell'app secondo le regole correnti.
- [ ] Completare classificazione contenuti, target audience e dichiarazioni richieste. Non dichiarare funzioni sanitarie inesistenti.
- [ ] Fornire accesso di revisione se richiesto, con account controllati e istruzioni per entrambi i ruoli.
- [ ] Caricare prima su Internal testing; installare tramite Play, verificare login e deep link e controllare i report pre-lancio.
- [ ] Eseguire eventuale closed testing richiesto per il tipo di account prima di richiedere produzione.
- [ ] Approvare manualmente il rilascio e prevedere un rollout graduale.

## Apple App Store

- [ ] Disporre di macOS, Xcode compatibile e iscrizione Apple Developer Program per distribuzione.
- [ ] Registrare l'App ID definitivo nel portale Apple, selezionare Team e Bundle Identifier in Xcode, verificare firma e provisioning.
- [ ] Impostare `Version` e `Build` crescente nel target App. Il build number deve distinguere ogni caricamento.
- [ ] Verificare deployment target, SDK richiesto e architetture supportate.
- [ ] Preparare App Icon in tutte le varianti previste, splash e screenshots reali iPhone/iPad se supportati.
- [ ] Controllare Privacy Manifest e Required Reason APIs delle dipendenze secondo le regole Apple correnti.
- [ ] Creare l'app in App Store Connect, completare nome, sottotitolo, descrizione, keyword, categoria, support URL e privacy policy URL.
- [ ] Compilare App Privacy sulla base dei dati effettivamente raccolti e collegati all'identità; includere i trattamenti Supabase e qualsiasi SDK futuro.
- [ ] Implementare il percorso di eliminazione account nell'app prima di presentarla alla revisione. Documentare le eventuali ragioni di conservazione legittima dei dati.
- [ ] Preparare contatti e note di revisione, account dimostrativi funzionanti per cliente e trainer e istruzioni per il flusso di prenotazione.
- [ ] Da Xcode selezionare una destinazione generica iOS, creare Archive e validare l'archivio prima dell'upload.
- [ ] Distribuire prima con TestFlight e verificare su un iPhone reale, compresi deep link e recupero password.
- [ ] Completare classificazione età, export compliance e altre dichiarazioni richieste in base alle caratteristiche reali.
- [ ] Richiedere la revisione e scegliere manualmente modalità/data di rilascio.

## Bloccanti della prima release pubblica

Finché testi legali, eliminazione account, configurazione produzione, firma, asset definitivi e test su dispositivi non sono completati, questa base MVP va usata per sviluppo e collaudo controllato. I requisiti degli store cambiano: controllare le guide ufficiali al momento della pubblicazione.
