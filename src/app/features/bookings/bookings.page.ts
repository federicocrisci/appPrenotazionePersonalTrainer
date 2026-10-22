import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonSegment, IonSegmentButton, IonLabel, IonSpinner, AlertController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import type { Booking } from '../../core/models';
import { BookingCardComponent } from '../../shared/components/booking-card.component';
import { canCancelBooking } from './cancellation';

@Component({
  selector: 'app-bookings', standalone: true,
  imports: [IonButton, IonContent, IonSegment, IonSegmentButton, IonLabel, IonSpinner, BookingCardComponent],
  template: `
    <ion-content><main class="page-container">
      <p class="eyebrow">Tutte le tue sessioni</p><h1>Le mie prenotazioni</h1>
      <ion-segment [value]="view()" (ionChange)="view.set($event.detail.value === 'history' ? 'history' : 'upcoming')" aria-label="Elenco prenotazioni">
        <ion-segment-button value="upcoming"><ion-label>Prossime</ion-label></ion-segment-button>
        <ion-segment-button value="history"><ion-label>Storico</ion-label></ion-segment-button>
      </ion-segment>
      @if (message()) { <p class="success-state" role="status">{{ message() }}</p> }
      @if (error()) { <div class="error-state" role="alert">{{ error() }}<ion-button fill="clear" (click)="load()">Aggiorna</ion-button></div> }
      @if (loading()) { <div class="loading-state" role="status"><ion-spinner/>Caricamento prenotazioni…</div> }
      @else {
        <p class="subtle">Date e orari nel fuso del tuo dispositivo. Le prenotazioni cancellate restano nello storico.</p>
        @for (booking of visible(); track booking.id) {
          <app-booking-card [booking]="booking" [trainer]="trainer()" [canCancel]="mayCancel(booking)" [busy]="cancelling() !== null" (cancelRequested)="askCancel($event)"/>
        } @empty { <div class="empty-state"><h2>{{ view() === 'upcoming' ? 'Nessun appuntamento in programma' : 'Lo storico è ancora vuoto' }}</h2><p>{{ view() === 'upcoming' ? 'Quando prenoti una sessione, la trovi qui.' : 'Qui ritroverai le sessioni concluse e cancellate.' }}</p></div> }
      }
    </main></ion-content>
  `,
  styles: [`ion-segment{margin:24px 0}.subtle{font-size:.85rem;color:var(--ion-color-medium-shade);margin:20px 0}.empty-state h2{font-size:1.1rem}.success-state{color:var(--ion-color-success-shade);padding:14px;background:var(--ion-color-success-tint);border-radius:12px}`],
})
export class BookingsPage {
  readonly auth = inject(AuthService);
  private readonly service = inject(BookingService);
  private readonly alerts = inject(AlertController);
  readonly trainer = computed(() => this.auth.profile()?.role === 'trainer');
  readonly view = signal<'upcoming' | 'history'>('upcoming');
  readonly all = signal<Booking[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  readonly cancelling = signal<string | null>(null);
  readonly visible = computed(() => this.all().filter(b => this.view() === 'upcoming'
    ? b.status === 'confirmed' && Date.parse(b.ends_at) > Date.now()
    : b.status !== 'confirmed' || Date.parse(b.ends_at) <= Date.now())
    .sort((a,b) => (Date.parse(a.starts_at)-Date.parse(b.starts_at))*(this.view() === 'upcoming' ? 1 : -1)));
  ionViewWillEnter(): void { void this.load(); }
  mayCancel(booking: Booking): boolean {
    return canCancelBooking(booking, this.trainer(), Date.now());
  }
  async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try { this.all.set(await this.service.bookings()); }
    catch (error) { this.error.set(this.service.message(error)); }
    finally { this.loading.set(false); }
  }
  async askCancel(booking: Booking): Promise<void> {
    if (this.cancelling()) return;
    const alert = await this.alerts.create({
      header: 'Cancellare l’appuntamento?',
      message: 'La prenotazione rimarrà nello storico. L’orario tornerà disponibile.',
      buttons: [{ text: 'Mantieni', role: 'cancel' }, { text: 'Cancella appuntamento', role: 'confirm' }],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') return;
    this.cancelling.set(booking.id); this.error.set(''); this.message.set('');
    try { await this.service.cancel(booking.id); this.message.set('Appuntamento cancellato.'); await this.load(); }
    catch (error) { this.error.set(this.service.message(error)); }
    finally { this.cancelling.set(null); }
  }
}
