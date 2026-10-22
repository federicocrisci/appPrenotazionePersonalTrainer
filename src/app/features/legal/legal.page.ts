import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton,IonContent } from '@ionic/angular/standalone';
@Component({ standalone: true, imports: [IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton,IonContent], template: `
  <ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/auth/register" text="Indietro"/></ion-buttons><ion-title>{{title}}</ion-title></ion-toolbar></ion-header>
  <ion-content><main class="page legal"><p class="eyebrow">DOCUMENTO PROVVISORIO · draft-v1</p><h1>{{title}}</h1>
  <p role="alert"><strong>Placeholder per sviluppo. Non è un testo legale definitivo. Non utilizzare questa versione per raccogliere dati reali in produzione.</strong></p>
  @if (privacy) {
    <p>L'MVP usa nome, cognome, email, ruolo, recapiti opzionali, disponibilità e prenotazioni per gestire gli appuntamenti. Non inserire dati sanitari nelle note o nel profilo.</p>
    <p>Prima del rilascio il titolare dovrà specificare identità e contatti, basi giuridiche e finalità, tempi di conservazione, fornitori e trasferimenti, diritti degli interessati, modalità di esportazione ed eliminazione e contatti dell'autorità competente.</p>
    <p>Il consenso alla lettura è registrato con data e versione del documento. La checkbox di questa demo non sostituisce la valutazione delle basi giuridiche.</p>
  } @else {
    <p>Prima del rilascio definire titolare del servizio, requisiti di utilizzo, responsabilità, regole di prenotazione e cancellazione, assistenza e procedure di chiusura account.</p>
  }
  <p>Esportazione ed eliminazione account devono essere completate e documentate prima della pubblicazione sugli store.</p></main></ion-content>` })
export class LegalPage {
  readonly privacy = inject(ActivatedRoute).snapshot.data['type'] !== 'terms';
  readonly title = this.privacy ? 'Informativa Privacy' : 'Termini e Condizioni';
}
