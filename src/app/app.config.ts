import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { NativeAuthService } from './core/services/native-auth.service';
export const appConfig: ApplicationConfig = {
  providers: [{ provide: LOCALE_ID, useValue: 'it-IT' }, provideIonicAngular({ mode: 'md' }), provideAnimationsAsync(),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      const nativeAuth = inject(NativeAuthService);
      return auth.initialize().then(() => nativeAuth.initialize());
    })]
};
