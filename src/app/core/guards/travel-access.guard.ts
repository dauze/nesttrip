import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Guard d'accès au programme de voyage.
 *
 * À compléter selon votre logique d'authentification :
 *   - Code PIN partagé stocké en sessionStorage / localStorage
 *   - Token JWT via un AuthService
 *   - Simple flag d'accès invité
 *
 * Exemple minimal avec un code PIN :
 *
 *   const PIN = '2026';
 *   const unlocked = sessionStorage.getItem('travel_unlocked');
 *   if (unlocked === PIN) return true;
 *   const entered = prompt('Code d\'accès ?');
 *   if (entered === PIN) {
 *     sessionStorage.setItem('travel_unlocked', PIN);
 *     return true;
 *   }
 *   return router.createUrlTree(['/locked']);
 */
export const travelAccessGuard: CanActivateFn = (_route, _state) => {
  const router = inject(Router);

  // TODO : remplacer par votre logique réelle
  const isAuthorized = true; // ← changer ici

  if (isAuthorized) {
    return true;
  }

  return router.createUrlTree(['/locked']);
};
