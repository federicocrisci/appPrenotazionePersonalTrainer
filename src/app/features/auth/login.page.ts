import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { errorMessage, reportError } from '../../shared/utils/errors';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner],
  template: `
    <ion-content>
      <main class="auth-wrap">
        <div class="brand"><span class="brand-mark" aria-hidden="true">PT</span> PT Booking</div>
        <p class="eyebrow">Il tuo prossimo passo</p>
        <h1>Bentornato.</h1>
        <p class="intro">Meno organizzazione, più allenamento. Accedi alla tua agenda.</p>
        @if (!supabase.configured) {
          <p class="feedback" role="status">Ambiente da configurare: inserisci URL e chiave pubblica Supabase nel file .env e riavvia l’app seguendo il README.</p>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <ion-input label="Email" labelPlacement="stacked" fill="outline" type="email" formControlName="email" autocomplete="email" inputmode="email" [maxlength]="254" />
          @if (form.controls.email.touched && form.controls.email.invalid) { <p class="field-error">Inserisci un indirizzo email valido.</p> }
          <ion-input label="Password" labelPlacement="stacked" fill="outline" type="password" formControlName="password" autocomplete="current-password"><ion-input-password-toggle slot="end" /></ion-input>
          @if (form.controls.password.touched && form.controls.password.invalid) { <p class="field-error">Inserisci la password.</p> }
          @if (error()) { <p class="feedback error" role="alert">{{ error() }}</p> }
          @if (auth.sessionError() && !error()) { <p class="feedback error" role="alert">{{ sessionError() }}</p> }
          <ion-button type="submit" expand="block" [disabled]="busy() || !supabase.configured">
            @if (busy()) { <ion-spinner name="crescent" aria-label="Accesso in corso" /> } @else { Accedi }
          </ion-button>
        </form>
        <div class="links"><a routerLink="/auth/reset-password">Password dimenticata?</a><p>Non hai un account? <a routerLink="/auth/register">Registrati</a></p></div>
      </main>
    </ion-content>
  `,
  styleUrl: './auth.scss',
})
export class LoginPage {
  readonly auth = inject(AuthService);
  readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', Validators.required],
  });

  sessionError(): string { return errorMessage(this.auth.sessionError()); }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const value = this.form.getRawValue();
      await this.auth.login(value.email, value.password);
      this.form.controls.password.reset();
      await this.router.navigateByUrl('/app/home', { replaceUrl: true });
    } catch (error) {
      reportError('Accesso', error);
      this.error.set(errorMessage(error));
    } finally { this.busy.set(false); }
  }
}
