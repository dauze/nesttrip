import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { routes } from './app.routes';
import { environment } from '../environnements/environnement';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import {fr} from 'primelocale/fr.json';
import { TravelLoaderService } from './core/infra/firebase/services/travel.loader.service';

const theme = definePreset(Aura, {
    semantic: {
        primary: {
          50: '#ECF6F5',
          100: '#D0EAE7',
          200: '#A1D5D0',
          300: '#6CBBB3',
          400: '#43A198',
          500: '#2A7871',
          600: '#21615B',
          700: '#1A4C47',
          800: '#133834',
          900: '#0C2422',
          950: '#061312'
      }
    }
});


// Init Firebase une seule fois, exporté pour être utilisé partout
const firebaseApp = initializeApp(environment.firebase);
export const firebaseAuth = getAuth(firebaseApp);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    providePrimeNG({
             theme: {
            preset: theme,
      },
      translation: fr
        }),
        {
      provide: APP_INITIALIZER,
      useFactory: (loader: TravelLoaderService) => () => {},
      deps: [TravelLoaderService],
      multi: true
    }
  ]
};
