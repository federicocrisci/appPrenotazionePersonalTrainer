import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { reportError } from '../../shared/utils/errors';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class NativeAuthService {
  private initialized = false;

  constructor(
    private readonly auth: AuthService,
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform() || !this.supabase.configured) return;
    this.initialized = true;
    await App.addListener('appUrlOpen', ({ url }) => { void this.handleUrl(url); });
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) this.supabase.client.auth.startAutoRefresh();
      else this.supabase.client.auth.stopAutoRefresh();
    });
    const launch = await App.getLaunchUrl();
    if (launch?.url) await this.handleUrl(launch.url);
  }

  private async handleUrl(rawUrl: string): Promise<void> {
    try {
      const url = new URL(rawUrl);
      const configured = environment.authRedirectUrl;
      const allowed = new URL(!configured || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(configured)
        ? 'ptbooking://auth/callback' : configured);
      if (url.protocol !== allowed.protocol || url.host !== allowed.host || url.pathname !== allowed.pathname) return;
      const code = url.searchParams.get('code');
      if (!code) return;
      const { error } = await this.supabase.client.auth.exchangeCodeForSession(code);
      if (error) throw error;
      await this.auth.refreshProfile();
      await this.router.navigateByUrl(url.searchParams.get('type') === 'recovery' || this.auth.passwordRecovery() ? '/auth/update-password' : '/app/home');
    } catch (error) {
      this.auth.sessionError.set(error);
      reportError('Conferma account o recupero password', error);
      await this.router.navigateByUrl('/auth/login');
    }
  }
}
