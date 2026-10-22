export type Role = 'trainer' | 'client';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: Role;
  avatar_url: string | null;
  phone: string | null;
  privacy_accepted_at: string;
  privacy_version: string;
  created_at?: string;
  updated_at?: string;
}

export interface TrainerProfile {
  user_id: string;
  bio: string;
  location: string;
  studio: string;
  session_duration_minutes: number;
  cancellation_hours: number;
  timezone: string;
  created_at?: string;
  updated_at?: string;
}

export interface TrainerSummary extends TrainerProfile {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface Booking {
  id: string;
  trainer_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  trainer_name: string;
  client_name: string;
  cancellation_hours?: number;
  trainer_timezone?: string;
}

export interface Slot {
  starts_at: string;
  ends_at: string;
}

export interface Availability {
  id: string;
  trainer_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilityException {
  id: string;
  trainer_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TrainerClient {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  next_booking_at: string | null;
  total_sessions: number;
}
