import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    { path: 'login', loadComponent: () => import('./features/travel/pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'app', loadComponent: () => import('./features/travel/pages/travel-page/travel-page.component').then(m => m.TravelPageComponent), canActivate: [authGuard] },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login', pathMatch: 'full' },
];
