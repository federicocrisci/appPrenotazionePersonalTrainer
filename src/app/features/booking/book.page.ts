import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonModal, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { BookingService } from '../../core/services/booking.service';
import type { Booking, Slot, TrainerSummary } from '../../core/models';
import { dateInZone } from '../../shared/utils/date';

@Component({
  selector: 'app-book', standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonModal, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar],
  template: `
    <ion-content><main class="page-container">
      <p class="eyebrow">Un appuntamento, pochi tocchi</p><h1>Prenota una sessione</h1>
      @if (loading()) { <div class="loading-state" role="status"><ion-spinner/>Caricamento trainer…</div> }
      @if (error()) { <div class="error-state" role="alert">{{ error() }}<ion-button fill="clear" (click)="load()">Aggiorna</ion-button></div> }
      @if (success(); as appointment) {
        <ion-card class="success-panel" role="status"><ion-card-content><h2>Prenotazione confermata</h2><strong>{{ appointment.trainer_name }}</strong><p>{{ appointment.starts_at | date:'EEEE d MMMM y' }}</p><p>{{ appointment.starts_at | date:'HH:mm' }} – {{ appointment.ends_at | date:'HH:mm' }}</p><p class="subtle">Orario nel fuso del tuo dispositivo.</p><ion-button expand="block" routerLink="/app/bookings">Le mie prenotazioni</ion-button></ion-card-content></ion-card>
      }
      @if (!loading() && trainers().length === 0 && !error()) { <p class="empty-state">Non ci sono ancora trainer disponibili. Riprova più tardi.</p> }
      @if (trainers().length) {
        <section aria-labelledby="trainer-heading"><h2 id="trainer-heading">1. Scegli il trainer</h2>
          <ion-select label="Personal Trainer" labelPlacement="stacked" interface="action-sheet" cancelText="Annulla" placeholder="Seleziona un trainer" [value]="trainerId" (ionChange)="selectTrainer($event.detail.value)">
            @for (trainer of trainers(); track trainer.user_id) { <ion-select-option [value]="trainer.user_id">{{ trainer.first_name }} {{ trainer.last_name }}{{ trainer.location ? ' · ' + trainer.location : '' }}</ion-select-option> }
          </ion-select>
          @if (selectedTrainer; as trainer) {
            <ion-card><ion-card-content><div class="trainer-heading">@if(trainer.avatar_url){<img class="avatar" [src]="trainer.avatar_url" alt="" referrerpolicy="no-referrer"/>}<strong>{{ trainer.first_name }} {{ trainer.last_name }}</strong></div><p>{{ trainer.bio }}</p>@if(trainer.location || trainer.studio){<p>{{ trainer.location }}{{ trainer.studio ? ' · ' + trainer.studio : '' }}</p>}<p class="subtle">{{ trainer.session_duration_minutes }} minuti · cancellazione entro {{ trainer.cancellation_hours }} ore prima</p></ion-card-content></ion-card>
          }
        </section>
        @if (selectedTrainer; as trainer) {
          <section aria-labelledby="day-heading"><h2 id="day-heading">2. Scegli il giorno</h2>
            <label class="field-label" for="booking-day">Giorno nel fuso del trainer ({{ trainer.timezone }})</label>
            <input id="booking-day" class="native-input" type="date" [min]="minDay" [ngModel]="day" (ngModelChange)="changeDay($event)"/>
          </section>
          <section aria-labelledby="time-heading"><h2 id="time-heading">3. Scegli l’orario</h2>
            <p class="subtle">Gli orari qui sotto sono mostrati nel fuso del tuo dispositivo: {{ localTimezone }}.</p>
            @if (slotsLoading()) { <div class="loading-state" role="status"><ion-spinner/>Controllo disponibilità…</div> }
            @else {
              <div class="slot-grid">@for (slot of slots(); track slot.starts_at) {
                <ion-button fill="outline" (click)="chooseSlot(slot)" [attr.aria-label]="'Prenota ' + (slot.starts_at | date:'d MMMM HH:mm')">{{ slot.starts_at | date:'HH:mm' }}<span class="slot-day">{{ slot.starts_at | date:'d MMM' }}</span></ion-button>
              } @empty { <p class="empty-state">Nessun orario disponibile per questo giorno. Prova un’altra data.</p> }</div>
            }
          </section>
        }
      }
    </main></ion-content>
    <ion-modal [isOpen]="selectedSlot() !== null" (didDismiss)="selectedSlot.set(null)" [canDismiss]="!booking()">
      <ng-template>
        <ion-header><ion-toolbar><ion-title>Conferma sessione</ion-title></ion-toolbar></ion-header>
        <ion-content><div class="page-container">
          @if (selectedSlot(); as slot) {
            <p class="eyebrow">Riepilogo</p><h2>{{ selectedTrainer?.first_name }} {{ selectedTrainer?.last_name }}</h2>
            <p>{{ slot.starts_at | date:'EEEE d MMMM y' }}</p><p class="summary-time">{{ slot.starts_at | date:'HH:mm' }} – {{ slot.ends_at | date:'HH:mm' }}</p>
            <p class="subtle">Orario nel fuso {{ localTimezone }}. La sessione dura {{ selectedTrainer?.session_duration_minutes }} minuti.</p>
            <p>Puoi cancellare fino a {{ selectedTrainer?.cancellation_hours }} ore prima dell’inizio.</p>
            <ion-textarea label="Nota per il trainer (opzionale)" labelPlacement="stacked" placeholder="Evita informazioni mediche o sensibili" [maxlength]="500" [counter]="true" [autoGrow]="true" [(ngModel)]="notes"/>
            <ion-button expand="block" [disabled]="booking()" (click)="confirm()">@if(booking()){<ion-spinner name="crescent"/>} Conferma prenotazione</ion-button>
            <ion-button expand="block" fill="clear" [disabled]="booking()" (click)="selectedSlot.set(null)">Torna agli orari</ion-button>
          }
        </div></ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`section{margin-top:28px}h2{font-size:1.12rem}.trainer-heading{display:flex;align-items:center;gap:12px;font-size:1rem;color:var(--ion-text-color)}.avatar{width:44px;height:44px;border-radius:50%;object-fit:cover}.slot-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.slot-grid ion-button{height:58px;margin:0}.slot-day{display:block;font-size:.72rem;margin-left:6px}.summary-time{font-size:2rem;font-weight:650}.success-panel{border:1px solid var(--ion-color-success);margin:20px 0}.success-panel h2{color:var(--ion-color-success-shade)}ion-select{border:1px solid var(--ion-color-light-shade);border-radius:12px;padding:12px}ion-textarea{margin:24px 0}.subtle{font-size:.85rem;color:var(--ion-color-medium-shade)}`],
})
export class BookPage {
  private readonly service = inject(BookingService);
  readonly trainers = signal<TrainerSummary[]>([]);
  readonly loading = signal(true);
  readonly slotsLoading = signal(false);
  readonly booking = signal(false);
  readonly error = signal('');
  readonly slots = signal<Slot[]>([]);
  readonly selectedSlot = signal<Slot | null>(null);
  readonly success = signal<Booking | null>(null);
  readonly localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  trainerId = '';
  day = '';
  notes = '';
  private requestId = 0;
  get selectedTrainer(): TrainerSummary | undefined { return this.trainers().find(t => t.user_id === this.trainerId); }
  get minDay(): string { return dateInZone(new Date(), this.selectedTrainer?.timezone ?? this.localTimezone); }
  ionViewWillEnter(): void { void this.load(); }
  async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try {
      this.trainers.set(await this.service.trainers());
      if (this.selectedTrainer) await this.refreshSlots();
    } catch (error) { this.error.set(this.service.message(error)); }
    finally { this.loading.set(false); }
  }
  selectTrainer(id: string): void {
    this.trainerId = id; this.day = this.minDay; this.success.set(null); this.selectedSlot.set(null);
    void this.refreshSlots();
  }
  changeDay(day: string): void { this.day = day; this.selectedSlot.set(null); void this.refreshSlots(); }
  chooseSlot(slot: Slot): void { this.notes = ''; this.success.set(null); this.selectedSlot.set(slot); }
  async refreshSlots(): Promise<void> {
    const id = ++this.requestId;
    this.slots.set([]); this.error.set('');
    if (!this.trainerId || !/^\d{4}-\d{2}-\d{2}$/.test(this.day)) return;
    this.slotsLoading.set(true);
    try { const slots = await this.service.slots(this.trainerId, this.day); if (id === this.requestId) this.slots.set(slots); }
    catch (error) { if (id === this.requestId) this.error.set(this.service.message(error)); }
    finally { if (id === this.requestId) this.slotsLoading.set(false); }
  }
  async confirm(): Promise<void> {
    const slot = this.selectedSlot(); const trainer = this.selectedTrainer;
    if (!slot || !trainer || this.booking()) return;
    this.booking.set(true); this.error.set('');
    let failure = '';
    try {
      const result = await this.service.book(trainer.user_id, slot.starts_at, this.notes);
      this.success.set({ ...result, trainer_name: `${trainer.first_name} ${trainer.last_name}` });
    } catch (error) { failure = this.service.message(error); }
    finally {
      this.booking.set(false); this.selectedSlot.set(null);
      await this.refreshSlots();
      if (failure) this.error.set(failure);
    }
  }
}
