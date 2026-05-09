import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  user,
  User
} from '@angular/fire/auth';
import { from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  // Observable du user courant (null si non connecté)
  readonly currentUser$: Observable<User | null> = user(this.auth);

  loginWithEmail(email: string, password: string): Observable<any> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      tap(() => this.router.navigate(['/app']))
    );
  }

  registerWithEmail(email: string, password: string): Observable<any> {
    return from(createUserWithEmailAndPassword(this.auth, email, password)).pipe(
      tap(() => this.router.navigate(['/app']))
    );
  }

  loginWithGoogle(): Observable<any> {
    const provider = new GoogleAuthProvider();
    return from(signInWithPopup(this.auth, provider)).pipe(
      tap(() => this.router.navigate(['/app']))
    );
  }

  logout(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      tap(() => this.router.navigate(['/login']))
    );
  }

  getToken(): Observable<string | null> {
    return new Observable(subscriber => {
      this.auth.currentUser?.getIdToken().then(token => {
        subscriber.next(token);
        subscriber.complete();
      }) ?? subscriber.next(null);
    });
  }
}