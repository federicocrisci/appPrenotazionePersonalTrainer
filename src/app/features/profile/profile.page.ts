import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertController, IonButton, IonContent, IonHeader, IonInput, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { errorMessage, reportError } from '../../shared/utils/errors';
import { nonBlank, optionalHttpsUrl, validTimezone } from '../../shared/utils/validators';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonContent, IonHeader, IonInput, IonSelect, IonSelectOption, IonSpinner, IonTextarea, IonTitle, IonToolbar],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly timezones = ['Europe/Rome', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];
  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [nonBlank, Validators.maxLength(80)]],
    lastName: ['', [nonBlank, Validators.maxLength(80)]],
    phone: ['', [Validators.maxLength(30), Validators.pattern(/^[\d+()\s.-]*$/)]],
    avatarUrl: ['', [optionalHttpsUrl, Validators.maxLength(2048)]],
    bio: ['', Validators.maxLength(1000)],
    location: ['', Validators.maxLength(120)],
    studio: ['', Validators.maxLength(120)],
    sessionDuration: [60, Validators.required],
    cancellationHours: [12, [Validators.required, Validators.min(0), Validators.max(168)]],
    timezone: ['Europe/Rome', [Validators.required, validTimezone]],
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set('');
    try {
      await this.auth.initialize();
      await this.auth.refreshProfile();
      const profile = this.auth.profile();
      if (!profile) throw new Error('NOT_AUTHORIZED');
      this.form.patchValue({ firstName: profile.first_name, lastName: profile.last_name, phone: profile.phone ?? '', avatarUrl: profile.avatar_url ?? '' });
      if (profile.role === 'trainer') {
        const trainer = await this.profiles.trainerProfile();
        this.form.patchValue({
          bio: trainer.bio, location: trainer.location, studio: trainer.studio,
          sessionDuration: trainer.session_duration_minutes, cancellationHours: trainer.cancellation_hours, timezone: trainer.timezone,
        });
      }
    } catch (error) {
      this.loadFailed.set(true);
      reportError('Caricamento profilo', error);
      this.error.set(errorMessage(error));
    } finally { this.loading.set(false); }
  }

  async save(): Promise<void> {
    if (this.saving() || this.loading() || this.loadFailed()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    let personalSaved = false;
    try {
      const value = this.form.getRawValue();
      await this.profiles.updateProfile({
        first_name: value.firstName.trim(), last_name: value.lastName.trim(),
        phone: value.phone.trim() || null, avatar_url: value.avatarUrl.trim() || null,
      });
      personalSaved = true;
      if (this.auth.profile()?.role === 'trainer') {
        await this.profiles.updateTrainer({
          bio: value.bio.trim(), location: value.location.trim(), studio: value.studio.trim(),
          session_duration_minutes: Number(value.sessionDuration), cancellation_hours: Number(value.cancellationHours), timezone: value.timezone.trim(),
        });
      }
      this.success.set('Profilo aggiornato.');
      this.form.markAsPristine();
    } catch (error) {
      reportError('Salvataggio profilo', error);
      this.error.set(`${personalSaved ? 'I dati personali sono stati salvati, ma le impostazioni del trainer non sono state aggiornate. ' : ''}${errorMessage(error)}`);
    } finally { this.saving.set(false); }
  }

  async logout(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Vuoi uscire?', message: 'Dovrai accedere di nuovo per consultare la tua agenda.',
      buttons: [{ text: 'Resta', role: 'cancel' }, { text: 'Esci', role: 'confirm' }],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') return;
    this.saving.set(true);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } catch (error) {
      reportError('Uscita', error);
      this.error.set(errorMessage(error));
    } finally { this.saving.set(false); }
  }
}
