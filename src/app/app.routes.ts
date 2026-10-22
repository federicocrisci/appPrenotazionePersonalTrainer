import { Routes } from '@angular/router';
import { authGuard, trainerGuard, clientGuard } from './core/guards/auth.guard';
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/home' },
  { path: 'auth/login', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
  { path: 'auth/register', loadComponent: () => import('./features/auth/register.page').then(m => m.RegisterPage) },
  { path: 'auth/reset-password', loadComponent: () => import('./features/auth/reset-password.page').then(m => m.ResetPasswordPage) },
  { path: 'auth/update-password', loadComponent: () => import('./features/auth/update-password.page').then(m => m.UpdatePasswordPage) },
  { path: 'auth/callback', loadComponent: () => import('./features/auth/callback.page').then(m => m.CallbackPage) },
  { path: 'privacy', data: { type: 'privacy' }, loadComponent: () => import('./features/legal/legal.page').then(m => m.LegalPage) },
  { path: 'terms', data: { type: 'terms' }, loadComponent: () => import('./features/legal/legal.page').then(m => m.LegalPage) },
  { path: 'app', canActivate: [authGuard], loadComponent: () => import('./shell/tabs.page').then(m => m.TabsPage), children: [
    { path: '', pathMatch: 'full', redirectTo: 'home' },
    { path: 'home', loadComponent: () => import('./features/home/home.page').then(m => m.HomePage) },
    { path: 'book', canActivate: [clientGuard], loadComponent: () => import('./features/booking/book.page').then(m => m.BookPage) },
    { path: 'bookings', loadComponent: () => import('./features/bookings/bookings.page').then(m => m.BookingsPage) },
    { path: 'calendar', canActivate: [trainerGuard], loadComponent: () => import('./features/calendar/calendar.page').then(m => m.CalendarPage) },
    { path: 'clients', canActivate: [trainerGuard], loadComponent: () => import('./features/clients/clients.page').then(m => m.ClientsPage) },
    { path: 'availability', canActivate: [trainerGuard], loadComponent: () => import('./features/availability/availability.page').then(m => m.AvailabilityPage) },
    { path: 'profile', loadComponent: () => import('./features/profile/profile.page').then(m => m.ProfilePage) }
  ] },
  { path: '**', redirectTo: 'app/home' }
];
