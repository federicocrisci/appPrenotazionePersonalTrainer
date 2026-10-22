import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
registerLocaleData(localeIt);
bootstrapApplication(AppComponent, appConfig).catch(error => console.error('Bootstrap failed', error));
