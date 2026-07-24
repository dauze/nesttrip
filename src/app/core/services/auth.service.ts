import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
  UserCredential,
} from 'firebase/auth';
import { from, Observable, switchMap } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { firebaseAuth } from '../../app.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  getCurrentUser(): User | null {
    return firebaseAuth.currentUser;
  }

  loginWithEmail(email: string, password: string): Observable<UserCredential> {
    return from(signInWithEmailAndPassword(firebaseAuth, email, password)).pipe(
      tap(() => this.router.navigate(['/app'])),
    );
  }

  registerWithEmail(email: string, password: string, firstName: string, lastName: string): Observable<UserCredential> {
    return from(createUserWithEmailAndPassword(firebaseAuth, email, password)).pipe(
      switchMap((credential) =>
        from(updateProfile(credential.user, {
          displayName: `${firstName} ${lastName}`,
        })).pipe(map(() => credential))
      ),
      tap(() => this.router.navigate(['/app'])),
    );
  }

  loginWithGoogle(): Observable<UserCredential> {
    const provider = new GoogleAuthProvider();
    return from(signInWithPopup(firebaseAuth, provider)).pipe(
      // Google remplit displayName automatiquement, rien à faire
      tap(() => this.router.navigate(['/app'])),
    );
  }

  logout(): Observable<void> {
    return from(signOut(firebaseAuth)).pipe(
      tap(() => this.router.navigate(['/login']))
    );
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