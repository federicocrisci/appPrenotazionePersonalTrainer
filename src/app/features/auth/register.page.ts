import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonCheckbox, IonContent, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular/standalone';
import { Role } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { errorMessage, reportError } from '../../shared/utils/errors';
import { nonBlank, strongPassword } from '../../shared/utils/validators';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonCheckbox, IonContent, IonInput, IonInputPasswordToggle, IonSelect, IonSelectOption, IonSpinner],
  template: `
    <ion-content>
      <main class="auth-wrap">
        <div class="brand"><span class="brand-mark" aria-hidden="true">PT</span> PT Booking</div>
        <p class="eyebrow">Iniziamo da te</p><h1>Trova il tuo ritmo.</h1>
        <p class="intro">Crea il tuo account e organizza i tuoi allenamenti in pochi tocchi.</p>
        @if (registered()) {
          <p class="feedback success" role="status">Controlla la tua casella email e apri il link di conferma. Poi torna qui per accedere. Se l’indirizzo è già registrato, puoi accedere o recuperare la password.</p>
          <ion-button expand="block" routerLink="/auth/login">Vai all’accesso</ion-button>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <ion-input label="Nome" labelPlacement="stacked" fill="outline" formControlName="firstName" autocomplete="given-name" [maxlength]="80" />
            @if (form.controls.firstName.touched && form.controls.firstName.invalid) { <p class="field-error">Inserisci il tuo nome (massimo 80 caratteri).</p> }
            <ion-input label="Cognome" labelPlacement="stacked" fill="outline" formControlName="lastName" autocomplete="family-name" [maxlength]="80" />
            @if (form.controls.lastName.touched && form.controls.lastName.invalid) { <p class="field-error">Inserisci il tuo cognome (massimo 80 caratteri).</p> }
            <ion-input label="Email" labelPlacement="stacked" fill="outline" type="email" formControlName="email" autocomplete="email" inputmode="email" [maxlength]="254" />
            @if (form.controls.email.touched && form.controls.email.invalid) { <p class="field-error">Inserisci un indirizzo email valido.</p> }
            <ion-input label="Password" labelPlacement="stacked" fill="outline" type="password" formControlName="password" autocomplete="new-password"><ion-input-password-toggle slot="end" /></ion-input>
            <p class="small">Almeno 12 caratteri, con almeno una minuscola, una maiuscola e un numero.</p>
            @if (form.controls.password.touched && form.controls.password.invalid) { <p class="field-error">La password non rispetta i requisiti indicati.</p> }
            <ion-select label="Come vuoi utilizzare l’app?" labelPlacement="stacked" fill="outline" formControlName="role" interface="popover">
              <ion-select-option value="client">Cliente</ion-select-option><ion-select-option value="trainer">Personal Trainer</ion-select-option>
            </ion-select>
            @if (form.controls.role.touched && form.controls.role.invalid) { <p class="field-error">Seleziona come vuoi utilizzare l’app.</p> }
            <div class="privacy"><ion-checkbox formControlName="privacy" aria-label="Ho letto e accetto l’Informativa Privacy" /><span>Ho letto e accetto l’<a routerLink="/privacy">Informativa Privacy</a>.</span></div>
            <p class="small">L’informativa e i <a routerLink="/terms">Termini e Condizioni</a> sono segnaposto per lo sviluppo e devono essere completati prima dell’utilizzo pubblico.</p>
            @if (form.controls.privacy.touched && form.controls.privacy.invalid) { <p class="field-error">Leggi e accetta l’Informativa Privacy per continuare.</p> }
            @if (error()) { <p class="feedback error" role="alert">{{ error() }}</p> }
            <ion-button type="submit" expand="block" [disabled]="busy()">
              @if (busy()) { <ion-spinner name="crescent" aria-label="Creazione account in corso" /> } @else { Crea account }
            </ion-button>
          </form>
        }
        <div class="links">Hai già un account? <a routerLink="/auth/login">Accedi</a></div>
      </main>
    </ion-content>
  `,
  styleUrl: './auth.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly registered = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [nonBlank, Validators.maxLength(80)]],
    lastName: ['', [nonBlank, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', strongPassword],
    role: ['' as Role | '', Validators.required],
    privacy: [false, Validators.requiredTrue],
  });

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { firstName, lastName, email, password, role } = this.form.getRawValue();
      if (!role) return;
      const signedIn = await this.auth.signUp({ firstName, lastName, email, password, role });
      this.form.controls.password.reset();
      if (signedIn) await this.router.navigateByUrl('/app/profile', { replaceUrl: true });
      else this.registered.set(true);
    } catch (error) {
      reportError('Registrazione', error);
      this.error.set(errorMessage(error));
    } finally { this.busy.set(false); }
  }
}
