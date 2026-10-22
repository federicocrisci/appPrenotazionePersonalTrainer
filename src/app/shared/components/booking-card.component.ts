import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonBadge, IonButton, IonCard, IonCardContent } from '@ionic/angular/standalone';
import type { Booking } from '../../core/models';

@Component({
  selector: 'app-booking-card', standalone: true,
  imports: [DatePipe, IonBadge, IonButton, IonCard, IonCardContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-card class="booking-card">
      <ion-card-content>
        <div class="booking-top"><strong>{{ trainer() ? booking().client_name : booking().trainer_name }}</strong>
          <ion-badge [color]="state() === 'cancelled' ? 'medium' : state() === 'completed' ? 'success' : 'primary'">{{ stateLabel() }}</ion-badge>
        </div>
        <p class="date">{{ booking().starts_at | date:'EEEE d MMMM y' }}</p>
        <p class="hours">{{ booking().starts_at | date:'HH:mm' }} – {{ booking().ends_at | date:'HH:mm' }}</p>
        <ion-button fill="clear" size="small" (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()">{{ expanded() ? 'Nascondi dettagli' : 'Visualizza appuntamento' }}</ion-button>
        @if (expanded()) {
          <div class="detail">
            <p>Durata: {{ duration() }} minuti</p>
            @if (booking().notes) { <p class="notes">Nota: {{ booking().notes }}</p> }
            <p class="subtle">Gli orari sono nel fuso del tuo dispositivo.</p>
            @if (canCancel()) {
              <ion-button color="danger" fill="outline" expand="block" [disabled]="busy()" (click)="cancelRequested.emit(booking())">Cancella appuntamento</ion-button>
            } @else if (state() === 'confirmed' && !trainer()) {
              <p class="subtle">La cancellazione in app non è più consentita. Contatta il trainer.</p>
            }
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    :host { display:block; } ion-card { margin:0 0 14px; } ion-card-content { padding:18px; }
    .booking-top {display:flex;align-items:center;justify-content:space-between;gap:12px;}
    strong {font-size:1rem;color:var(--ion-text-color);} .date{margin-top:10px;text-transform:capitalize;}
    .hours {font-size:1.4rem;font-weight:650;color:var(--ion-text-color);margin-top:3px;}
    ion-button {margin-left:0;} .detail{border-top:1px solid var(--ion-color-light-shade);padding-top:12px;margin-top:6px;}
    .notes{white-space:pre-wrap;overflow-wrap:anywhere;} .subtle{font-size:.85rem;margin:10px 0;}
  `],
})
export class BookingCardComponent {
  readonly booking = input.required<Booking>();
  readonly trainer = input(false);
  readonly canCancel = input(false);
  readonly busy = input(false);
  readonly cancelRequested = output<Booking>();
  readonly expanded = signal(false);
  state(): string {
    return this.booking().status === 'confirmed' && Date.parse(this.booking().ends_at) <= Date.now() ? 'completed' : this.booking().status;
  }
  stateLabel(): string { return ({confirmed:'Confermato',cancelled:'Cancellato',completed:'Completato'} as Record<string,string>)[this.state()] ?? this.state(); }
  duration(): number { return Math.round((Date.parse(this.booking().ends_at) - Date.parse(this.booking().starts_at))/60000); }
}
