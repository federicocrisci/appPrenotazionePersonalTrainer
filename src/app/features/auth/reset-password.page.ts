import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { errorMessage, reportError } from '../../shared/utils/errors';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonContent, IonInput, IonSpinner],
  template: `
    <ion-content><main class="auth-wrap">
      <div class="brand"><span class="brand-mark" aria-hidden="true">PT</span> PT Booking</div>
      <h1>Recupera l’accesso.</h1><p class="intro">Ti invieremo un link per scegliere una nuova password.</p>
      @if (sent()) {
        <p class="feedback success" role="status">Se esiste un account associato a questa email, riceverai le istruzioni per reimpostare la password. Controlla anche la cartella spam.</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <ion-input label="Email" labelPlacement="stacked" fill="outline" type="email" formControlName="email" autocomplete="email" inputmode="email" [maxlength]="254" />
          @if (form.controls.email.touched && form.controls.email.invalid) { <p class="field-error">Inserisci un indirizzo email valido.</p> }
          @if (error()) { <p class="feedback error" role="alert">{{ error() }}</p> }
          <ion-button type="submit" expand="block" [disabled]="busy()">@if (busy()) { <ion-spinner name="crescent" aria-label="Invio in corso" /> } @else { Invia link di recupero }</ion-button>
        </form>
      }
      <div class="links"><a routerLink="/auth/login">Torna all’accesso</a></div>
    </main></ion-content>
  `,
  styleUrl: './auth.scss',
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  readonly busy = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]] });

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.resetPassword(this.form.getRawValue().email);
      this.sent.set(true);
    } catch (error) {
      reportError('Recupero password', error);
      this.error.set(errorMessage(error));
    } finally { this.busy.set(false); }
  }
}
