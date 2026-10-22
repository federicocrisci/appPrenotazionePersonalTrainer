import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonContent, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import type { Booking } from '../../core/models';
import { localDateKey } from '../../shared/utils/date';
import { BookingCardComponent } from '../../shared/components/booking-card.component';

@Component({
  selector: 'app-home', standalone: true,
  imports: [DatePipe, RouterLink, IonButton, IonCard, IonCardContent, IonContent, IonSpinner, BookingCardComponent],
  template: `
    <ion-content><main class="page-container">
      <p class="eyebrow">PT Booking · {{ trainer() ? 'Personal Trainer' : 'Cliente' }}</p>
      <h1>Ciao, {{ auth.profile()?.first_name }}</h1>
      <p class="page-subtitle">{{ trainer() ? 'La tua giornata, a colpo d’occhio.' : 'Il prossimo passo verso il tuo obiettivo.' }}</p>
      @if (loading()) { <div class="loading-state" role="status"><ion-spinner/><span>Caricamento appuntamenti…</span></div> }
      @else if (error()) { <div class="error-state" role="alert">{{ error() }}<ion-button fill="clear" (click)="load()">Riprova</ion-button></div> }
      @else {
        <h2>Prossimo appuntamento</h2>
        @if (next(); as appointment) { <app-booking-card [booking]="appointment" [trainer]="trainer()"/><ion-button fill="clear" [routerLink]="trainer() ? '/app/calendar' : '/app/bookings'">Visualizza appuntamento</ion-button> }
        @else { <ion-card><ion-card-content><p>Non hai appuntamenti in programma.</p></ion-card-content></ion-card> }
        @if (trainer()) {
          <h2>Appuntamenti di oggi <span class="count">{{ today().length }}</span></h2>
          @for (appointment of today(); track appointment.id) {
            <a class="today-row" routerLink="/app/calendar"><span>{{ appointment.starts_at | date:'HH:mm' }}</span><strong>{{ appointment.client_name }}</strong></a>
          } @empty { <p class="empty-state">Oggi non hai appuntamenti confermati.</p> }
          <div class="action-grid">
            <ion-button expand="block" routerLink="/app/calendar">Apri calendario</ion-button>
            <ion-button expand="block" fill="outline" routerLink="/app/availability">Gestisci disponibilità</ion-button>
            <ion-button expand="block" fill="outline" routerLink="/app/clients">I tuoi clienti</ion-button>
          </div>
        } @else {
          <ion-card class="booking-cta"><ion-card-content><p class="eyebrow">Trova il tuo momento</p><h2>Prenota una sessione</h2><p>Scegli il tuo trainer e trova l’orario giusto per te.</p><ion-button expand="block" routerLink="/app/book">Prenota una sessione</ion-button></ion-card-content></ion-card>
          <ion-button expand="block" fill="outline" routerLink="/app/bookings">Le mie prenotazioni</ion-button>
        }
      }
    </main></ion-content>
  `,
  styles: [`h2{font-size:1.15rem;margin-top:28px}.count{font-size:.9rem;color:var(--ion-color-medium);margin-left:8px}.today-row{display:flex;gap:20px;padding:17px 0;border-bottom:1px solid var(--ion-color-light-shade);text-decoration:none;color:var(--ion-text-color)}.today-row span{font-weight:650;color:var(--ion-color-primary)}.action-grid{display:grid;gap:8px;margin-top:25px}.booking-cta{margin:25px 0;background:var(--ion-color-primary);color:white}.booking-cta p,.booking-cta h2{color:white}.booking-cta ion-button{--background:white;--color:var(--ion-color-primary);margin-top:20px}`],
})
export class HomePage {
  readonly auth = inject(AuthService);
  private readonly service = inject(BookingService);
  readonly trainer = computed(() => this.auth.profile()?.role === 'trainer');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly bookings = signal<Booking[]>([]);
  readonly next = computed(() => this.bookings().find(b => b.status === 'confirmed' && Date.parse(b.starts_at) > Date.now()));
  readonly today = computed(() => this.bookings().filter(b => b.status === 'confirmed' && localDateKey(new Date(b.starts_at)) === localDateKey(new Date())));
  ionViewWillEnter(): void { void this.load(); }
  async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try { this.bookings.set((await this.service.bookings()).sort((a,b) => Date.parse(a.starts_at)-Date.parse(b.starts_at))); }
    catch (error) { this.error.set(this.service.message(error)); }
    finally { this.loading.set(false); }
  }
}
