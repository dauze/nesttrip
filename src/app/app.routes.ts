import { Routes } from '@angular/router';
import { travelAccessGuard } from './core/guards/travel-access.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [travelAccessGuard],
    loadComponent: () =>
      import('./features/travel/pages/travel-page/travel-page.component').then(
        m => m.TravelPageComponent
      ),
  },
  {
    path: 'locked',
    loadComponent: () =>
      import('./features/travel/pages/travel-page/travel-page.component').then(
        // TODO : créer un LockedPageComponent si nécessaire
        m => m.TravelPageComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
