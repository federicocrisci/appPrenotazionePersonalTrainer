import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertController, IonBackButton, IonButton, IonButtons, IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonCheckbox, IonContent, IonHeader, IonInput,
  IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner,
  IonTitle, IonToolbar,
} from '@ionic/angular/standalone';
import { Availability, AvailabilityException } from '../../core/models';
import { BookingService } from '../../core/services/booking.service';
import { dateInZone } from '../../shared/utils/date';
import { blockInterval } from './availability.utils';

@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [FormsModule, RouterLink, IonBackButton, IonButton, IonButtons, IonCard,
    IonCardContent, IonCardHeader, IonCardTitle, IonCheckbox, IonContent, IonHeader,
    IonInput, IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner,
    IonTitle, IonToolbar],
  templateUrl: './availability.page.html',
  styleUrl: './availability.page.scss',
})
export class AvailabilityPage implements OnInit {
  private readonly bookings = inject(BookingService);
  private readonly alerts = inject(AlertController);
  readonly rows = signal<Availability[]>([]);
  readonly blocks = signal<AvailabilityException[]>([]);
  readonly timezone = signal('Europe/Rome');
  readonly loading = signal(false);
  readonly initialized = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly days = [
    { value: 1, label: 'Lunedì' }, { value: 2, label: 'Martedì' },
    { value: 3, label: 'Mercoledì' }, { value: 4, label: 'Giovedì' },
    { value: 5, label: 'Venerdì' }, { value: 6, label: 'Sabato' },
    { value: 7, label: 'Domenica' },
  ];
  editingId: string | undefined;
  weekday = 1;
  startTime = '09:00';
  endTime = '13:00';
  blockStartDate = '';
  blockEndDate = '';
  blockStartTime = '09:00';
  blockEndTime = '18:00';
  allDay = true;
  reason = 'absence';

  ngOnInit(): void { void this.load(); }
  ionViewWillEnter(): void { void this.load(); }

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const [rows, blocks, profile] = await Promise.all([
        this.bookings.availability(), this.bookings.exceptions(),
        this.bookings.ownTrainerProfile(),
      ]);
      this.rows.set(rows);
      this.blocks.set(blocks);
      this.timezone.set(profile.timezone);
      this.initialized.set(true);
      if (!this.blockStartDate) {
        this.blockStartDate = dateInZone(new Date(), profile.timezone);
        this.blockEndDate = this.blockStartDate;
      }
    } catch (error: unknown) {
      this.error.set(this.bookings.message(error));
    } finally { this.loading.set(false); }
  }

  forDay(weekday: number): Availability[] {
    return this.rows().filter(row => row.weekday === weekday)
      .sort((left, right) => left.start_time.localeCompare(right.start_time));
  }

  edit(row: Availability): void {
    this.editingId = row.id;
    this.weekday = row.weekday;
    this.startTime = row.start_time.slice(0, 5);
    this.endTime = row.end_time.slice(0, 5);
    this.error.set('');
    this.notice.set('Fascia selezionata. Modifica il modulo e salva.');
    document.getElementById('weekly-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  resetWeekly(): void {
    this.editingId = undefined;
    this.startTime = '09:00';
    this.endTime = '13:00';
  }

  async saveWeekly(): Promise<void> {
    if (!this.initialized()) return;
    this.error.set('');
    if (!/^[0-2]\d:[0-5]\d$/.test(this.startTime) ||
        !/^[0-2]\d:[0-5]\d$/.test(this.endTime) ||
        this.startTime >= this.endTime) {
      this.error.set('Scegli un orario di fine successivo all’inizio nello stesso giorno.');
      return;
    }
    const conflict = this.rows().some(row => row.id !== this.editingId &&
      row.weekday === Number(this.weekday) &&
      this.startTime < row.end_time.slice(0, 5) && this.endTime > row.start_time.slice(0, 5));
    if (conflict) {
      this.error.set('Questa fascia si sovrappone a un’altra disponibilità dello stesso giorno.');
      return;
    }
    await this.change(async () => {
      await this.bookings.saveAvailability({ id: this.editingId, weekday: Number(this.weekday),
        start_time: this.startTime, end_time: this.endTime });
      this.resetWeekly();
    }, 'Disponibilità salvata. I nuovi slot sono già prenotabili.');
  }

  async removeWeekly(row: Availability): Promise<void> {
    if (!(await this.confirm('Eliminare questa fascia?',
      'I nuovi slot di questa fascia non saranno più disponibili. Le prenotazioni esistenti restano in agenda.'))) return;
    await this.change(() => this.bookings.removeAvailability(row.id), 'Fascia eliminata.');
    if (this.editingId === row.id) this.resetWeekly();
  }

  async clearDay(weekday: number): Promise<void> {
    if (!(await this.confirm('Rendere il giorno non disponibile?',
      'Verranno eliminate tutte le fasce settimanali di questo giorno. Le prenotazioni esistenti restano in agenda.'))) return;
    await this.change(() => this.bookings.clearWeekday(weekday), 'Giorno impostato come non disponibile.');
    if (Number(this.weekday) === weekday) this.resetWeekly();
  }

  async addBlock(): Promise<void> {
    if (!this.initialized()) return;
    this.error.set('');
    try {
      if (!this.blockStartDate || !this.blockEndDate || this.blockEndDate < this.blockStartDate) {
        this.error.set('Scegli le date di inizio e fine del periodo.');
        return;
      }
      const { starts_at, ends_at } = blockInterval({ startDate: this.blockStartDate,
        endDate: this.blockEndDate, startTime: this.blockStartTime, endTime: this.blockEndTime,
        allDay: this.allDay, timezone: this.timezone() });
      if (!(await this.confirm('Confermare il periodo non disponibile?',
        'Nessuno potrà prenotare in questo intervallo. Se ci sono appuntamenti confermati, annullali prima di aggiungere il blocco.'))) return;
      await this.change(() => this.bookings.saveException({ starts_at, ends_at,
        reason: this.reason }), 'Periodo non disponibile aggiunto.');
    } catch (error: unknown) {
      console.error('Invalid availability interval', error);
      this.error.set('Data o ora non valida nella timezone scelta. Durante il cambio dell’ora seleziona un intervallo non ambiguo.');
    }
  }

  async removeBlock(block: AvailabilityException): Promise<void> {
    if (!(await this.confirm('Rimuovere il blocco?',
      'Gli orari compresi nella disponibilità settimanale torneranno prenotabili.'))) return;
    await this.change(() => this.bookings.removeException(block.id), 'Blocco rimosso.');
  }

  blockLabel(block: AvailabilityException): string {
    const format = new Intl.DateTimeFormat('it-IT', {
      timeZone: this.timezone(), dateStyle: 'medium', timeStyle: 'short',
    });
    return `${format.format(new Date(block.starts_at))} – ${format.format(new Date(block.ends_at))}`;
  }

  reasonLabel(reason: string | null | undefined): string {
    return ({ absence: 'Assenza', vacation: 'Ferie', blocked: 'Blocco orario' } as Record<string, string>)[reason ?? '']
      ?? reason ?? 'Non disponibile';
  }

  private async change(action: () => Promise<void>, success: string): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await action();
      await this.load();
      if (!this.error()) this.notice.set(success);
    } catch (error: unknown) { this.error.set(this.bookings.message(error)); }
    finally { this.saving.set(false); }
  }

  private async confirm(header: string, message: string): Promise<boolean> {
    const alert = await this.alerts.create({ header, message,
      buttons: [{ text: 'Indietro', role: 'cancel' }, { text: 'Conferma', role: 'confirm' }],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }
}
