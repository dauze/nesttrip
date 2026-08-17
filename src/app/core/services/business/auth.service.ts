import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionCodeSettings,
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  User,
  UserCredential,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { from, Observable, switchMap } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { firebaseAuth } from '@app/app.config';
import { UserProfileRepository } from '@core/infra/firebase/services/user-profile-repository';

/**
 * `handleCodeInApp: true` : les liens envoyés par Firebase (réinitialisation
 * de mot de passe, vérification d'email) redirigent directement vers
 * `AuthActionComponent` (`/auth/action?mode=...&oobCode=...`) au lieu de la
 * page hébergée par défaut de Firebase (non stylée, hors de l'app) —
 * ROADMAP.md "### UI".
 */
const ACTION_CODE_SETTINGS: ActionCodeSettings = {
  url: `${location.origin}/auth/action`,
  handleCodeInApp: true,
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private readonly userProfileRepository = inject(UserProfileRepository);

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

  /**
   * Email non vérifié : la session Firebase reste active (nécessaire pour
   * `resendVerificationEmail`, qui a besoin d'un `currentUser` — Firebase ne
   * permet pas de renvoyer un mail de vérification sans être connecté), mais
   * on ne navigue PAS vers `/app` — voir `authGuard`, qui bloque `/trips`
   * pour un compte non vérifié même si l'utilisateur force l'URL. C'est
   * `LoginComponent` qui détecte ce cas (`getCurrentUser()?.emailVerified
   * === false`) et affiche le rappel + le renvoi, sur CET écran plutôt que
   * dans l'app (retour utilisateur 2026-08-09 : pas d'accès à l'app tant que
   * le compte n'est pas vérifié).
   */
  loginWithEmail(email: string, password: string): Observable<UserCredential> {
    return from(signInWithEmailAndPassword(firebaseAuth, email, password)).pipe(
      tap((credential) => {
        if (!credential.user.emailVerified) return;
        this.justLoggedIn.set(true);
        this.router.navigate(['/app']);
      }),
    );
  }

  registerWithEmail(email: string, password: string, firstName: string, lastName: string): Observable<UserCredential> {
    const displayName = `${firstName} ${lastName}`;
    return from(createUserWithEmailAndPassword(firebaseAuth, email, password)).pipe(
      switchMap((credential) =>
        from(updateProfile(credential.user, { displayName })).pipe(map(() => credential))
      ),
      tap((credential) => {
        // Fire-and-forget : ne bloque pas le reste du flux.
        sendEmailVerification(credential.user, ACTION_CODE_SETTINGS).catch((e) => {
          console.error("Erreur lors de l'envoi de l'e-mail de vérification :", e);
        });

        // Création de `users/{uid}` dès l'inscription (voir
        // `UserProfileRepository.createUserProfile`) — fire-and-forget comme
        // les autres écritures ponctuelles de ce doc (`UserProfileService`) :
        // le compte Auth existe déjà à ce stade, un raté ici ne doit pas
        // bloquer la suite.
        this.userProfileRepository.createUserProfile(credential.user.uid, credential.user.email ?? email, displayName).catch((e) => {
          console.error('[AuthService] Erreur lors de la création du profil utilisateur :', e);
        });
        // Pas de navigation : un compte fraîchement créé n'est jamais vérifié
        // (voir la doc de `loginWithEmail` ci-dessus) — reste sur l'écran de
        // login, qui affiche le rappel "vérifiez votre email".
      }),
    );
  }

  loginWithGoogle(): Observable<UserCredential> {
    const provider = new GoogleAuthProvider();
    return from(signInWithPopup(firebaseAuth, provider)).pipe(
      // Google remplit displayName automatiquement, rien à faire
      tap((credential) => {
        // `isNewUser` (pas un appel systématique) : un login Google d'un
        // compte déjà existant ne doit JAMAIS rappeler `createUserProfile`,
        // qui écrase `companions` à `{}` (voir sa doc) — perdrait les
        // companions réels d'un utilisateur qui revient se connecter.
        if (getAdditionalUserInfo(credential)?.isNewUser) {
          this.userProfileRepository
            .createUserProfile(credential.user.uid, credential.user.email ?? '', credential.user.displayName ?? undefined)
            .catch(() => undefined);
        }
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

  // --- NOUVEAU : Méthode utilitaire pour renvoyer le mail si besoin ---
  resendVerificationEmail(): Observable<void> {
    const currentUser = firebaseAuth.currentUser;
    if (currentUser && !currentUser.emailVerified) {
      return from(sendEmailVerification(currentUser, ACTION_CODE_SETTINGS));
    }
    return from(Promise.resolve());
  }

  resetPassword(email: string): Observable<void> {
    return from(sendPasswordResetEmail(firebaseAuth, email, ACTION_CODE_SETTINGS));
  }

  // --- Action Firebase (lien email) : voir AuthActionComponent ---

  /** Vérifie que le lien de réinitialisation (`oobCode`) est valide et non expiré — retourne l'email associé si oui (affiché dans le formulaire de nouveau mot de passe), rejette sinon. */
  checkPasswordResetCode(oobCode: string): Observable<string> {
    return from(verifyPasswordResetCode(firebaseAuth, oobCode));
  }

  /** Applique le nouveau mot de passe — `oobCode` déjà validé par `checkPasswordResetCode`. */
  submitNewPassword(oobCode: string, newPassword: string): Observable<void> {
    return from(confirmPasswordReset(firebaseAuth, oobCode, newPassword));
  }

  /** Marque l'email vérifié — `oobCode` du lien de confirmation d'inscription. */
  confirmEmailVerification(oobCode: string): Observable<void> {
    return from(applyActionCode(firebaseAuth, oobCode));
  }
}