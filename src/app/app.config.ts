import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { routes } from './app.routes';
import { environment } from '@environments/environment';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import localeFr from '@angular/common/locales/fr';
import { registerLocaleData } from '@angular/common';
import { GoogleMapsLoaderService } from './core/services/api/google-maps-loader.service';
import { ThemeService } from './core/services/ui/theme.service';
import { VisualViewportService } from './core/services/ui/visual-viewport.service';
import { onViewTransitionCreated } from './core/navigation/route-transition';
import { UserProfileRepository } from './core/infra/firebase/services/user-profile-repository';
import { FirebaseUserProfileRepository } from './core/infra/firebase/services/firebase-user-profile-repository';
import { TravelRouteRepository } from './core/infra/firebase/services/travel-route-repository';
import { FirebaseTravelRouteRepository } from './core/infra/firebase/services/firebase-travel-route-repository';
import { ExchangeRateRepository } from './core/infra/firebase/services/exchange-rate-repository';
import { FirebaseExchangeRateRepository } from './core/infra/firebase/services/firebase-exchange-rate-repository';
import { TripGenerationRepository } from './core/infra/firebase/services/trip-generation-repository';
import { FirebaseTripGenerationRepository } from './core/infra/firebase/services/firebase-trip-generation-repository';

registerLocaleData(localeFr);

// Init Firebase une seule fois, exporté pour être utilisé partout
export const firebaseApp = initializeApp(environment.firebase);
export const firebaseAuth = getAuth(firebaseApp);

export const appConfig: ApplicationConfig = {
  providers: [
    // `zone.js` n'a jamais été un polyfill du projet (absent d'angular.json/package.json) :
    // l'app tournait déjà en zoneless "implicite" (fallback silencieux d'Angular en
    // l'absence de Zone globale). Rendu explicite ici plutôt que de continuer à
    // dépendre d'un comportement de repli non garanti par l'API publique.
    provideZonelessChangeDetection(),
    provideRouter(routes, withViewTransitions({ onViewTransitionCreated })),
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideAppInitializer(() => inject(GoogleMapsLoaderService).load()),
    // Instancie ThemeService dès le bootstrap (pas seulement une fois /trips
    // atteint) : applique le data-theme stocké (localStorage) dès la
    // première peinture, y compris sur /login — un service root n'est créé
    // qu'à sa première injection, sans ce hook il resterait inerte tant
    // qu'aucun composant ne l'injecte.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Même raison que ThemeService ci-dessus : un service root ne s'instancie
    // qu'à sa première injection — sans ce hook, `--nt-visual-viewport-height`
    // (voir dialog.scss) resterait absente tant qu'aucun composant ne
    // l'injecte, laissant les tout premiers dialogs ouverts sans ce garde-fou.
    provideAppInitializer(() => {
      inject(VisualViewportService);
    }),
    FirebaseUserProfileRepository,
    { provide: UserProfileRepository, useExisting: FirebaseUserProfileRepository },
    FirebaseTravelRouteRepository,
    { provide: TravelRouteRepository, useExisting: FirebaseTravelRouteRepository },
    FirebaseExchangeRateRepository,
    { provide: ExchangeRateRepository, useExisting: FirebaseExchangeRateRepository },
    FirebaseTripGenerationRepository,
    { provide: TripGenerationRepository, useExisting: FirebaseTripGenerationRepository },
  ],
};
