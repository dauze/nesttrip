import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { firebaseAuth } from '../../app.config';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  return new Observable<boolean>(subscriber => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, user => {
      subscriber.next(!!user);
      subscriber.complete();
    });
    return unsubscribe;
  }).pipe(
    take(1),
    map(isAuth => {
      if (isAuth) return true;
      router.navigate(['/login']);
      return false;
    })
  );
};