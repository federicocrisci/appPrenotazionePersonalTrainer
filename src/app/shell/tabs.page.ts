import { Component, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, calendarOutline, peopleOutline, personOutline, addCircleOutline, listOutline } from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
@Component({ standalone: true, imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon], template: `
  <ion-tabs><ion-tab-bar slot="bottom" aria-label="Navigazione principale">
    <ion-tab-button tab="home" href="/app/home"><ion-icon name="home-outline" aria-hidden="true"/><ion-label>Home</ion-label></ion-tab-button>
    @if (auth.profile()?.role === 'trainer') {
      <ion-tab-button tab="calendar" href="/app/calendar"><ion-icon name="calendar-outline" aria-hidden="true"/><ion-label>Calendario</ion-label></ion-tab-button>
      <ion-tab-button tab="clients" href="/app/clients"><ion-icon name="people-outline" aria-hidden="true"/><ion-label>Clienti</ion-label></ion-tab-button>
    } @else {
      <ion-tab-button tab="book" href="/app/book"><ion-icon name="add-circle-outline" aria-hidden="true"/><ion-label>Prenota</ion-label></ion-tab-button>
      <ion-tab-button tab="bookings" href="/app/bookings"><ion-icon name="list-outline" aria-hidden="true"/><ion-label>Prenotazioni</ion-label></ion-tab-button>
    }
    <ion-tab-button tab="profile" href="/app/profile"><ion-icon name="person-outline" aria-hidden="true"/><ion-label>Profilo</ion-label></ion-tab-button>
  </ion-tab-bar></ion-tabs>` })
export class TabsPage {
  readonly auth = inject(AuthService);
  constructor() { addIcons({ homeOutline, calendarOutline, peopleOutline, personOutline, addCircleOutline, listOutline }); }
}
