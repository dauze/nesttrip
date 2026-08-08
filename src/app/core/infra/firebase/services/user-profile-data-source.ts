import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { arrayUnion, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { UserProfileFirebase } from '@app/core/infra/firebase/models/user-profile.dto';
import { userProfileFromFb } from '@app/core/infra/firebase/mappers/user-profile.mapper';
import { UserProfile } from '@app/core/models/user-profile.dto';

@Injectable({ providedIn: 'root' })
export class UserProfileDataSource {
  private readonly db = inject(FirebaseService).db;

  /**
   * Création du doc `users/{uid}` à l'inscription (voir `AuthService`) —
   * `companions: {}` toujours vide ici : la dénormalisation bidirectionnelle
   * des companions reste réservée au serveur (`add-collaborator.handler.ts`,
   * Admin SDK), voir firestore.rules (`allow create` dédié, valide justement
   * que `companions == {}`). `merge: true` par prudence (même choix que
   * `markOnboardingStepSeen` ci-dessous) : sans risque de doublon puisque
   * `registerWithEmail`/`loginWithGoogle` n'appellent ceci que pour un uid
   * fraîchement créé, jamais réappelé ensuite pour ce même compte.
   */
  createUserProfile(uid: string, email: string, displayName?: string): Promise<void> {
    return setDoc(doc(this.db, 'users', uid), { uid, email, displayName, companions: {} }, { merge: true });
  }

  /** Écriture ponctuelle du seul champ client-writable de `users/{uid}` (voir firestore.rules) — pas de DebounceWriter, un simple bouton bascule. */
  setMapCollapsedByDefault(uid: string, value: boolean): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { mapCollapsedByDefault: value });
  }

  /** Écriture ponctuelle (même moule que `setMapCollapsedByDefault`) — simple picker dans les paramètres, pas de frappe continue. */
  setDefaultCurrency(uid: string, value: string): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { defaultCurrency: value });
  }

  /**
   * `setDoc(..., { merge: true })`, PAS `updateDoc` (contrairement à
   * `setMapCollapsedByDefault`/`setDefaultCurrency` ci-dessus) : ce champ est
   * quasi systématiquement la TOUTE PREMIÈRE écriture jamais faite sur
   * `users/{uid}` pour un nouvel utilisateur (le doc n'est aujourd'hui créé
   * paresseusement que via les Cloud Functions de collaboration, voir
   * `add-collaborator.handler.ts`) — `updateDoc` sur un doc inexistant lève
   * `NOT_FOUND`. Un objet imbriqué littéral (pas de clé à points) merge
   * correctement `onboarding` sans écraser le reste du champ s'il existe déjà.
   */
  markOnboardingStepSeen(uid: string, stepId: string): Promise<void> {
    return setDoc(doc(this.db, 'users', uid), { onboarding: { seenStepIds: arrayUnion(stepId) } }, { merge: true });
  }

  /** Même raison que `markOnboardingStepSeen` — voir `UserProfileService.completeOnboardingIntro`. */
  completeOnboardingIntro(uid: string): Promise<void> {
    return setDoc(doc(this.db, 'users', uid), { onboarding: { hasSeenOnboarding: true } }, { merge: true });
  }

  getUserProfile$(uid: string): Observable<UserProfile> {
    return new Observable((observer) => {
      const unsub = onSnapshot(
        doc(this.db, 'users', uid),
        (snap) => {
          const data = snap.data();
          observer.next(
            data
              ? userProfileFromFb(data as UserProfileFirebase)
              : { uid, email: '', companions: {} },
          );
        },
        (err) => observer.error(err),
      );
      return () => unsub();
    });
  }
}
