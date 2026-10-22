import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonButton, IonCard, IonCardContent, IonContent, IonSpinner } from '@ionic/angular/standalone';
import { BookingService, type TrainerClient } from '../../core/services/booking.service';

@Component({
  selector:'app-clients', standalone:true,
  imports:[DatePipe, IonButton, IonCard, IonCardContent, IonContent, IonSpinner],
  template:`<ion-content><main class="page-container"><p class="eyebrow">Le persone che alleni</p><h1>I tuoi clienti</h1><p class="page-subtitle">Chi ha prenotato almeno una sessione con te.</p>
    @if(loading()){<div class="loading-state" role="status"><ion-spinner/>Caricamento clienti…</div>}
    @else if(error()){<div class="error-state" role="alert">{{error()}}<ion-button fill="clear" (click)="load()">Riprova</ion-button></div>}
    @else {
      @for(client of clients();track client.id){
        <ion-card><ion-card-content><div class="client-title">@if(client.avatar_url){<img [src]="client.avatar_url" alt="" referrerpolicy="no-referrer"/>}<h2>{{client.first_name}} {{client.last_name}}</h2></div>
          <p>Sessioni totali: <strong>{{client.total_sessions}}</strong></p>
          @if(client.next_booking_at){<p>Prossima: {{client.next_booking_at|date:'d MMMM y, HH:mm'}}</p>}@else{<p>Nessuna sessione in programma</p>}
        </ion-card-content></ion-card>
      }@empty{<div class="empty-state"><h2>Inizia dalla disponibilità</h2><p>Quando un cliente prenoterà una sessione, apparirà qui.</p></div>}
      <p class="subtle">Le sessioni totali comprendono confermate e completate; le cancellazioni sono escluse.</p>
    }
  </main></ion-content>`,
  styles:[`.client-title{display:flex;gap:12px;align-items:center;margin-bottom:12px}.client-title h2{font-size:1.1rem;font-weight:650;color:var(--ion-text-color)}.client-title img{width:44px;height:44px;border-radius:50%;object-fit:cover}.subtle{font-size:.8rem;color:var(--ion-color-medium-shade)}`],
})
export class ClientsPage {
  private readonly service=inject(BookingService);
  readonly clients=signal<TrainerClient[]>([]);
  readonly loading=signal(true);
  readonly error=signal('');
  ionViewWillEnter():void{void this.load();}
  async load():Promise<void>{
    this.loading.set(true);this.error.set('');
    try{this.clients.set(await this.service.clients());}
    catch(error){this.error.set(this.service.message(error));}
    finally{this.loading.set(false);}
  }
}
