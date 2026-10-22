# Verifica dell'MVP

Data: **22 ottobre 2026 (UTC)**. Verifiche eseguite nell'ambiente cloud Linux sul backend Supabase locale reale, con PostgreSQL 17, Auth e REST. I risultati descrivono questa istanza e il codice verificato; non attestano un deploy ospitato, una build nativa o una pubblicazione sugli store.

## Risultati eseguiti

| Comando o controllo | Esito |
| --- | --- |
| `npm run lint` | Superato |
| `npm run typecheck` | Superato, inclusi template Angular, test e configurazioni TypeScript |
| Installazione da lockfile | Script completo rieseguito con `npm ci`, avvio backend, controlli e build: superato |
| `npm test` | **32 test unitari superati**, nessuno saltato |
| `npm run check:local -- test:db` | **16 test PostgreSQL reali superati**, nessuno saltato |
| `npm run check:local -- test:auth` | **6 test Auth HTTP reali superati**, nessuno saltato |
| `npm run check:local -- test:e2e` | **1 scenario browser mobile end-to-end superato**, nessuno saltato |
| `npm run build` | Build web superata |
| `npm audit --omit=dev` | Nessuna vulnerabilità segnalata per le dipendenze di produzione al momento del controllo |
| Seed locale demo | Eseguito due volte con successo: ricreazione ripetibile dei soli quattro account demo |
| Creazione progetti Capacitor Android/iOS e `cap sync` | Superata; file nativi e plugin sincronizzati |
| `cap doctor` Android | Configurazione verificata; non è una compilazione del binario |

I test unitari coprono autenticazione e gestione sessione, validazione, messaggi di errore, cutoff di cancellazione e conversioni timezone/DST. I test PostgreSQL verificano anche RLS e autorizzazioni, privacy, slot, blocchi e cancellazioni. La prova di concorrenza conferma che due richieste sul medesimo slot producono una sola prenotazione; è verificata anche la sovrapposizione del medesimo cliente presso trainer diversi.

Lo scenario browser usa account creati nel backend reale: registra un trainer, imposta lunedì 09:00–13:00, registra un cliente, mostra 09:00/10:00/11:00/12:00, prenota 10:00, verifica la conferma e la presenza in agenda del trainer con il nome cliente; infine registra un secondo cliente e controlla che 10:00 non sia più disponibile. Le fixture del test vengono eliminate al termine.

## Configurazione operativa del backend locale

Il wrapper `scripts/supabase.mjs` usa le immagini **slim ufficialmente supportate** dalla CLI Supabase, adatte alle risorse del Docker locale. La CLI risolve gli artefatti slim ufficiali su GHCR tramite digest; Docker Hub è configurato per le immagini standard di supporto. Lo stato CLI è in un percorso ignorato dal repository. Non disabilita verifica TLS, firme o checksum.

Nel cloud i proxy iniettati possono far transitare la sonda interna di loopback del container Auth attraverso il proxy e produrre un falso errore HTTP 403. Per l'avvio slim il wrapper usa l'opzione supportata `--ignore-health-check`, poi esegue **obbligatoriamente** `scripts/check-readiness.mjs`: richieste HTTP reali ad Auth e REST, connessione PostgreSQL e presenza della funzione di prenotazione migrata. Se questi controlli falliscono, l'avvio restituisce un errore. L'esito positivo delle suite Auth e database è una verifica funzionale ulteriore.

Per la prova browser di questa macchina è stato usato **Chromium 154** già installato, con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`: il CDN di download Playwright non era accessibile dalla policy di rete cloud. Sul proprio computer il percorso normale resta `npx playwright install chromium`; l'override del binario è facoltativo e non richiede di disabilitare controlli di integrità.

Le password demo sono state generate per il solo collaudo e non sono salvate nel repository né riportate qui. Per accedere ai propri account demo, scegliere una nuova `DEMO_PASSWORD` nel proprio ambiente e rieseguire `npm run demo:seed`, sapendo che ricrea i soli quattro account demo e il loro storico.

## Controlli ancora da eseguire fuori da questa macchina

- **Supabase ospitato:** nessun progetto remoto è stato creato o configurato; nessuna chiave personale è stata fornita. Applicare le migration e configurare Auth/SMTP/redirect nel proprio progetto seguendo il README. La conferma email ospitata e il recapito SMTP non sono attestati dai test locali.
- **Android:** l'SDK Android non è presente in questa macchina; nessun APK/AAB è stato compilato o installato. Restano il controllo in Android Studio, la firma e il collaudo su dispositivo.
- **iOS:** Xcode non è disponibile su Linux; nessuna build iOS, firma o installazione su iPhone è stata eseguita. Il progetto Swift Package Manager è predisposto per l'apertura su Mac.
- **Dispositivi e accessibilità:** completare la [checklist Android/iOS](mobile-testing.md), inclusi deep link reali, tastiera, lettori di schermo, rete intermittente e ciclo di vita dell'app nativa.
- **CI GitHub:** il workflow [MVP checks](../.github/workflows/ci.yml) è predisposto; non è stato eseguito su GitHub durante questo lavoro. I risultati sopra sono quelli dell'ambiente cloud, non uno stato di CI remoto.
- **Release pubblica:** completare testi legali, eliminazione account, identità/asset definitivi, configurazione produzione e [checklist store](publication-checklist.md). Nessuna pubblicazione automatica è stata effettuata.

## Configurazione cloud salvata

Sono stati salvati e riletti con esito positivo i campi `install_script` e `start_skill` nella bozza dell'ambiente. Lo script di installazione è stato eseguito in questa macchina con successo. È stato dichiarato il percorso effettivo del checkout `appPrenotazionePersonalTrainer`, con HEAD ancora privo di commit; il lavoro creato è presente nel workspace.

Il salvataggio della bozza è distinto dalla pubblicazione di uno snapshot. Per riutilizzare l'ambiente in task futuri occorre rivedere e salvare le impostazioni dell'ambiente, quindi pubblicare l'ambiente tramite l'interfaccia. Questa operazione non è stata eseguita automaticamente e non pubblica l'app sugli store. Il ripristino in una nuova istanza non è stato verificato; una futura istanza o un backend ospitato richiedono i rispettivi controlli di avvio e configurazione.
