import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('@features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'trips',
    loadComponent: () => import('@features/trips/trips.component').then((m) => m.TripsComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/trips/accueil-trip/accueil-trip.component').then(
            (m) => m.AccueilTripComponent,
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('@features/trips/new-trip/new-trip.component').then(
            (m) => m.NewTripComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('@features/trips/trip-detail/trip-detail.component').then(
            (m) => m.TripDetailComponent,
          ),
      },
    ],
  },
  { path: '', redirectTo: 'trips', pathMatch: 'full' },
  { path: '**', redirectTo: 'trips' },
];
 
