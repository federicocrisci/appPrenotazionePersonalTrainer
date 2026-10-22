import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { errorMessage, reportError } from '../../shared/utils/errors';
import { strongPassword } from '../../shared/utils/validators';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner],
  template: `
    <ion-content><main class="auth-wrap">
      <div class="brand"><span class="brand-mark" aria-hidden="true">PT</span> PT Booking</div>
      <h1>Una nuova password.</h1><p class="intro">Scegli almeno 12 caratteri, con almeno una minuscola, una maiuscola e un numero.</p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <ion-input label="Nuova password" labelPlacement="stacked" fill="outline" type="password" formControlName="password" autocomplete="new-password"><ion-input-password-toggle slot="end" /></ion-input>
        @if (form.controls.password.touched && form.controls.password.invalid) { <p class="field-error">La password non rispetta i requisiti indicati.</p> }
        @if (error()) { <p class="feedback error" role="alert">{{ error() }}</p> }
        <ion-button type="submit" expand="block" [disabled]="busy()">@if (busy()) { <ion-spinner name="crescent" aria-label="Salvataggio in corso" /> } @else { Salva password }</ion-button>
      </form>
      <div class="links"><a routerLink="/auth/reset-password">Richiedi un nuovo link</a></div>
    </main></ion-content>
  `,
  styleUrl: './auth.scss',
})
export class UpdatePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({ password: ['', strongPassword] });

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.initialize();
      if (!this.auth.user()) {
        this.error.set('Il link non è valido o è scaduto. Richiedi un nuovo link di recupero.');
        return;
      }
      await this.auth.updatePassword(this.form.getRawValue().password);
      this.form.controls.password.reset();
      await this.router.navigateByUrl('/app/home', { replaceUrl: true });
    } catch (error) {
      reportError('Aggiornamento password', error);
      this.error.set(errorMessage(error));
    } finally { this.busy.set(false); }
  }
}
