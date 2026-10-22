import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import type { Availability, AvailabilityException, Booking, Slot, TrainerProfile, TrainerSummary } from '../models';

export interface TrainerClient {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  next_booking_at: string | null;
  total_sessions: number;
}

/** The database remains authoritative for authorization and booking consistency. */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private get trainerId(): string {
    const profile = this.auth.profile();
    if (!profile || profile.role !== 'trainer') throw new Error('NOT_AUTHORIZED');
    return profile.id;
  }

  private async rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.client.rpc(name, args);
    if (error) throw error;
    return data as T;
  }

  trainers(): Promise<TrainerSummary[]> { return this.rpc('list_trainers'); }
  bookings(): Promise<Booking[]> { return this.rpc('get_my_bookings'); }
  clients(): Promise<TrainerClient[]> { return this.rpc('get_trainer_clients'); }
  slots(trainerId: string, day: string): Promise<Slot[]> {
    return this.rpc('get_available_slots', { p_trainer_id: trainerId, p_date: day });
  }
  async book(trainerId: string, startsAt: string, notes: string): Promise<Booking> {
    const result = await this.rpc<Booking | Booking[]>('create_booking', {
      p_trainer_id: trainerId, p_starts_at: startsAt, p_notes: notes.trim() || null,
    });
    return Array.isArray(result) ? result[0]! : result;
  }
  async cancel(id: string): Promise<Booking> {
    const result = await this.rpc<Booking | Booking[]>('cancel_booking', { p_booking_id: id });
    return Array.isArray(result) ? result[0]! : result;
  }
  async ownTrainerProfile(): Promise<TrainerProfile> {
    const { data, error } = await this.supabase.client.from('trainer_profiles').select('*').eq('user_id', this.trainerId).single();
    if (error) throw error;
    return data as TrainerProfile;
  }
  async availability(): Promise<Availability[]> {
    const { data, error } = await this.supabase.client.from('trainer_availability').select('*')
      .eq('trainer_id', this.trainerId).order('weekday').order('start_time');
    if (error) throw error;
    return data as Availability[];
  }
  async saveAvailability(value: { id?: string; weekday: number; start_time: string; end_time: string }): Promise<void> {
    const { id, ...interval } = value;
    const query = id
      ? this.supabase.client.from('trainer_availability').update(interval).eq('id', id).eq('trainer_id', this.trainerId)
      : this.supabase.client.from('trainer_availability').insert({ ...interval, trainer_id: this.trainerId });
    const { error } = await query;
    if (error) throw error;
  }
  async removeAvailability(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('trainer_availability').delete().eq('id', id).eq('trainer_id', this.trainerId);
    if (error) throw error;
  }
  async clearWeekday(weekday: number): Promise<void> {
    const { error } = await this.supabase.client.from('trainer_availability').delete().eq('weekday', weekday).eq('trainer_id', this.trainerId);
    if (error) throw error;
  }
  async exceptions(): Promise<AvailabilityException[]> {
    const { data, error } = await this.supabase.client.from('trainer_availability_exceptions').select('*')
      .eq('trainer_id', this.trainerId).order('starts_at');
    if (error) throw error;
    return data as AvailabilityException[];
  }
  async saveException(value: { starts_at: string; ends_at: string; reason: string }): Promise<void> {
    const { error } = await this.supabase.client.from('trainer_availability_exceptions').insert({ ...value, trainer_id: this.trainerId });
    if (error) throw error;
  }
  async removeException(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('trainer_availability_exceptions').delete().eq('id', id).eq('trainer_id', this.trainerId);
    if (error) throw error;
  }
  message(error: unknown): string { return bookingErrorMessage(error); }
}

export function bookingErrorMessage(error: unknown): string {
  const failure = error as { code?: string; message?: string } | null;
  const message = failure?.message ?? '';
  if (message.includes('AVAILABILITY_CONFLICT')) return 'Questo periodo contiene appuntamenti confermati. Annullali prima di bloccare l’orario.';
  if (failure?.code === '23P01' || message.includes('SLOT_UNAVAILABLE')) {
    return 'Questo orario è stato appena prenotato o non è più disponibile. Seleziona un altro orario.';
  }
  if (message.includes('BOOKING_CUTOFF')) return 'Il termine per cancellare questo appuntamento è scaduto. Contatta il trainer.';
  if (message.includes('BOOKING_NOT_CANCELLABLE')) return 'Questo appuntamento non può più essere cancellato. Aggiorna la pagina.';
  if (failure?.code === '23514' || failure?.code === '22023' || message.includes('INVALID_INPUT')) return 'Controlla i dati inseriti e gli intervalli orari.';
  if (message.includes('NOT_AUTHORIZED') || failure?.code === '42501' || failure?.code === 'PGRST301') return 'La sessione è scaduta o non hai accesso a questa operazione. Accedi nuovamente.';
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('fetch failed')) return 'Connessione non disponibile. Controlla la rete e riprova.';
  if (message.toLowerCase().includes('timeout') || failure?.code === '57014') return 'Il server non ha risposto in tempo. Riprova tra poco.';
  return 'Non è stato possibile completare l’operazione. Riprova tra poco.';
}
