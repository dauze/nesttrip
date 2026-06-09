import { firebaseAuth } from '@app/app.config';
import { onAuthStateChanged } from 'firebase/auth';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';


export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  return new Observable<boolean>(subscriber => onAuthStateChanged(firebaseAuth, (user: any) => {
      subscriber.next(!!user);
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
