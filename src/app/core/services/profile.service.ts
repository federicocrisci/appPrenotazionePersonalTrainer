import { Injectable } from '@angular/core';
import { TrainerProfile } from '../models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

export interface ProfileChanges {
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
}

export type TrainerChanges = Pick<TrainerProfile, 'bio' | 'location' | 'studio' | 'session_duration_minutes' | 'cancellation_hours' | 'timezone'>;

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private readonly supabase: SupabaseService, private readonly auth: AuthService) {}

  async trainerProfile(): Promise<TrainerProfile> {
    const { data, error } = await this.supabase.client.from('trainer_profiles').select('*').eq('user_id', this.currentId()).single();
    if (error) throw error;
    return data as TrainerProfile;
  }

  async updateProfile(changes: ProfileChanges): Promise<void> {
    const { error } = await this.supabase.client.from('profiles').update(changes).eq('id', this.currentId()).select('id').single();
    if (error) throw error;
    await this.auth.refreshProfile();
  }

  async updateTrainer(changes: TrainerChanges): Promise<void> {
    const { error } = await this.supabase.client.from('trainer_profiles').update(changes).eq('user_id', this.currentId()).select('user_id').single();
    if (error) throw error;
  }

  private currentId(): string {
    const id = this.auth.user()?.id;
    if (!id) throw new Error('NOT_AUTHORIZED');
    return id;
  }
}
