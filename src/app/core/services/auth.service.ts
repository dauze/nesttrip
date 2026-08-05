import { inject, Injectable, signal } from '@angular/core';
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

  /**
   * Vrai à l'ouverture de la web app, jusqu'à ce qu'`AccueilTripComponent`
   * l'ait consommé une fois — lui seul décide s'il y a lieu de rediriger
   * directement vers l'unique trip existant (voir ROADMAP.md : uniquement à
   * l'ouverture, jamais lors d'un retour manuel depuis un trip). Initialisé à
   * `true` : `AuthService` (`providedIn: 'root'`) est instancié une seule
   * fois par chargement de page, donc sa construction coïncide avec
   * l'ouverture de l'app — ça couvre aussi bien la session déjà authentifiée
   * restaurée par Firebase au démarrage (aucune des méthodes ci-dessous
   * n'est appelée dans ce cas) que le login interactif classique. Remis à
   * `true` explicitement dans les 3 méthodes de connexion pour le cas d'un
   * logout puis re-login sans recharger la page (le flag a déjà été
   * consommé par le premier montage d'`AccueilTripComponent`). Un simple
   * flag booléen plutôt qu'une lecture de l'historique de navigation :
   * capture directement l'INTENTION à la source, sans heuristique sur l'URL
   * précédente. `AuthService` (root) ne peut pas injecter `TripFacade`
   * (scopé à la route /trips) pour décider lui-même du nombre de trips.
   */
  readonly justLoggedIn = signal(true);

  getCurrentUser(): User | null {
    return firebaseAuth.currentUser;
  }

  loginWithEmail(email: string, password: string): Observable<UserCredential> {
    return from(signInWithEmailAndPassword(firebaseAuth, email, password)).pipe(
      tap(() => {
        this.justLoggedIn.set(true);
        this.router.navigate(['/app']);
      }),
    );
  }

  registerWithEmail(email: string, password: string, firstName: string, lastName: string): Observable<UserCredential> {
    return from(createUserWithEmailAndPassword(firebaseAuth, email, password)).pipe(
      switchMap((credential) =>
        from(updateProfile(credential.user, {
          displayName: `${firstName} ${lastName}`,
        })).pipe(map(() => credential))
      ),
      tap(() => {
        this.justLoggedIn.set(true);
        this.router.navigate(['/app']);
      }),
    );
  }

  loginWithGoogle(): Observable<UserCredential> {
    const provider = new GoogleAuthProvider();
    return from(signInWithPopup(firebaseAuth, provider)).pipe(
      // Google remplit displayName automatiquement, rien à faire
      tap(() => {
        this.justLoggedIn.set(true);
        this.router.navigate(['/app']);
      }),
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