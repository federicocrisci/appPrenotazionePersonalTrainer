import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { Profile, Role } from '../models';
import { PRIVACY_VERSION } from '../../shared/utils/validators';
import { reportError } from '../../shared/utils/errors';
import { SupabaseService } from './supabase.service';

export interface Registration {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly ready = signal(false);
  readonly sessionError = signal<unknown>(null);
  readonly passwordRecovery = signal(false);
  private initialization?: Promise<void>;
  private sessionRevision = 0;
  private initialSessionEvent?: { event: AuthChangeEvent; session: Session | null };

  constructor(private readonly supabase: SupabaseService, private readonly router: Router) {}

  initialize(): Promise<void> {
    this.initialization ??= this.restoreSession();
    return this.initialization;
  }

  private async restoreSession(): Promise<void> {
    try {
      if (!this.supabase.configured) return;
      const client = this.supabase.client;
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') this.passwordRecovery.set(true);
        // Session restoration owns profile loading until ready. In particular,
        // INITIAL_SESSION must not supersede its query and release guards early.
        if (!this.ready()) {
          this.initialSessionEvent = { event, session };
          return;
        }
        // Awaiting another Supabase request inside this callback can deadlock its auth lock.
        queueMicrotask(() => { void this.handleAuthEvent(event, session); });
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      let initial = this.initialSessionEvent;
      await this.applySession(initial ? initial.session : data.session);
      // A sign-out or recovery event may arrive while the profile query is in
      // flight. Drain it before exposing a ready state to route guards.
      while (this.initialSessionEvent !== initial) {
        initial = this.initialSessionEvent;
        if (initial) await this.applySession(initial.session);
      }
    } catch (error) {
      this.sessionError.set(error);
      reportError('Ripristino sessione', error);
    } finally {
      this.loading.set(false);
      this.ready.set(true);
      this.initialSessionEvent = undefined;
    }
  }

  private async handleAuthEvent(event: AuthChangeEvent, session: Session | null): Promise<void> {
    try {
      await this.applySession(session);
      if (event === 'PASSWORD_RECOVERY') await this.router.navigateByUrl('/auth/update-password');
      if (event === 'SIGNED_OUT') await this.router.navigateByUrl('/auth/login');
    } catch (error) {
      this.sessionError.set(error);
      reportError('Aggiornamento sessione', error);
    }
  }

  private async applySession(session: Session | null): Promise<void> {
    const revision = ++this.sessionRevision;
    const previousId = this.user()?.id;
    this.user.set(session?.user ?? null);
    if (!session) {
      this.profile.set(null);
      this.sessionError.set(null);
      return;
    }
    if (previousId !== session.user.id) this.profile.set(null);
    const { data, error } = await this.supabase.client.from('profiles').select('*').eq('id', session.user.id).single();
    if (revision !== this.sessionRevision) return;
    if (error) throw error;
    this.profile.set(data as Profile);
    this.sessionError.set(null);
  }

  async refreshProfile(): Promise<void> {
    const id = this.user()?.id;
    if (!id) return;
    const { data, error } = await this.supabase.client.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;
    if (this.user()?.id !== id) return;
    this.profile.set(data as Profile);
  }

  async login(email: string, password: string): Promise<void> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    await this.applySession(data.session);
  }

  async signUp(input: Registration): Promise<boolean> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email: input.email.trim(), password: input.password,
      options: {
        emailRedirectTo: this.redirectUrl(),
        data: {
          first_name: input.firstName.trim(), last_name: input.lastName.trim(), role: input.role,
          privacy_accepted: true, privacy_version: PRIVACY_VERSION,
        },
      },
    });
    if (error) throw error;
    if (data.session) await this.applySession(data.session);
    return Boolean(data.session);
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: this.redirectUrl(),
    });
    if (error) throw error;
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) throw error;
    this.passwordRecovery.set(false);
  }

  async logout(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    await this.applySession(null);
  }

  private redirectUrl(): string {
    const configured = environment.authRedirectUrl;
    if (Capacitor.isNativePlatform() && (!configured || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(configured))) {
      return 'ptbooking://auth/callback';
    }
    return configured || `${window.location.origin}/auth/callback`;
  }
}
