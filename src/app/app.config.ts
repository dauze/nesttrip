import { ApplicationConfig, inject, LOCALE_ID, provideAppInitializer } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { routes } from './app.routes';
import { environment } from '@environments/environment';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import localeFr from '@angular/common/locales/fr';
import { registerLocaleData } from '@angular/common';
import { GoogleMapsLoaderService } from './core/services/google-maps-loader.service';
import { onViewTransitionCreated } from './core/navigation/route-transition';
import { UserProfileRepository } from './core/infra/firebase/services/user-profile-repository';
import { FirebaseUserProfileRepository } from './core/infra/firebase/services/firebase-user-profile-repository';

registerLocaleData(localeFr);

// Init Firebase une seule fois, exporté pour être utilisé partout
export const firebaseApp = initializeApp(environment.firebase);
export const firebaseAuth = getAuth(firebaseApp);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions({ onViewTransitionCreated })),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideAppInitializer(() => inject(GoogleMapsLoaderService).load()),
    FirebaseUserProfileRepository,
    { provide: UserProfileRepository, useExisting: FirebaseUserProfileRepository },
  ]
};