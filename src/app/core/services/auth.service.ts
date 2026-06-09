import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { firebaseAuth } from '../../app.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  // Observable du user courant via onAuthStateChanged
  readonly currentUser$ = new Observable<User | null>((subscriber) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      subscriber.next(user);
    });
    return unsubscribe; // cleanup auto au unsubscribe
  });

  loginWithEmail(email: string, password: string): Observable<any> {
    return from(signInWithEmailAndPassword(firebaseAuth, email, password)).pipe(
      tap(() => this.router.navigate(['/app'])),
    );
  }

  registerWithEmail(email: string, password: string): Observable<any> {
    return from(createUserWithEmailAndPassword(firebaseAuth, email, password)).pipe(
      tap(() => this.router.navigate(['/app'])),
    );
  }

  loginWithGoogle(): Observable<any> {
    const provider = new GoogleAuthProvider();
    return from(signInWithPopup(firebaseAuth, provider)).pipe(
      tap(() => this.router.navigate(['/app'])),
    );
  }

  logout(): Observable<void> {
    return from(signOut(firebaseAuth)).pipe(tap(() => this.router.navigate(['/login'])));
  }

  getToken(): Observable<string | null> {
    return new Observable((subscriber) => {
      const currentUser = firebaseAuth.currentUser;
      if (currentUser) {
        currentUser.getIdToken().then((token) => {
          subscriber.next(token);
          subscriber.complete();
        });
      } else {
        subscriber.next(null);
        subscriber.complete();
      }
    });
  }
}
