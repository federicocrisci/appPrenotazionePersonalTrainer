import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { errorMessage } from '../../shared/utils/errors';

@Component({
  standalone: true,
  imports: [RouterLink, IonButton, IonContent, IonSpinner],
  template: `
    <ion-content><main class="auth-wrap">
      <div class="brand"><span class="brand-mark" aria-hidden="true">PT</span> PT Booking</div>
      <h1>Conferma accesso.</h1>
      @if (error()) {
        <p class="feedback error" role="alert">{{ error() }}</p>
        <ion-button routerLink="/auth/login" expand="block">Torna all’accesso</ion-button>
        <div class="links"><a routerLink="/auth/reset-password">Richiedi un nuovo link di recupero</a></div>
      } @else { <ion-spinner name="crescent" aria-label="Verifica del link in corso" /> }
    </main></ion-content>
  `,
  styleUrl: './auth.scss',
})
export class CallbackPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    await this.auth.initialize();
    if (this.auth.sessionError()) this.error.set(errorMessage(this.auth.sessionError()));
    else if (!this.auth.user()) this.error.set('Il link non è valido, è scaduto oppure è stato aperto su un dispositivo diverso. Torna all’accesso o richiedi un nuovo link dallo stesso dispositivo.');
    else await this.router.navigateByUrl(this.auth.passwordRecovery() ? '/auth/update-password' : '/app/home', { replaceUrl: true });
  }
}
