import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();
  return Boolean(auth.user() && auth.profile()) || router.parseUrl('/auth/login');
};

function forRole(role: Role): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.initialize();
    if (!auth.user()) return router.parseUrl('/auth/login');
    return auth.profile()?.role === role || router.parseUrl('/app/home');
  };
}

export const trainerGuard = forRole('trainer');
export const clientGuard = forRole('client');
