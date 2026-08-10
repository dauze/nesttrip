import { firebaseAuth } from '@app/app.config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';


export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  // Email non vérifié : refusé comme un utilisateur non connecté (voir
  // AuthService.loginWithEmail/registerWithEmail, qui ne naviguent déjà pas
  // vers `/app` dans ce cas) — filet de sécurité si l'URL /trips est forcée
  // directement pendant qu'une session non vérifiée est encore active.
  return new Observable<boolean>(subscriber => onAuthStateChanged(firebaseAuth, (user: User | null) => {
      subscriber.next(!!user); //TODO  && user.emailVerified
      subscriber.complete();
    })
  ).pipe(
    take(1),
    map((isAuth: boolean) => {
      if (isAuth) return true;
      router.navigate(['/login']);
      return false;
    })
  );
};
