import { Observable } from 'rxjs';
import { UserProfile } from '@app/core/models/user-profile.dto';

export abstract class UserProfileRepository {
  abstract getUserProfile$(uid: string): Observable<UserProfile>;
  /** Crée `users/{uid}` à l'inscription (voir `AuthService.registerWithEmail`/`loginWithGoogle`) — le doc n'existait auparavant que via une écriture onboarding-only ou via les Cloud Functions de collaboration, laissant un nouveau compte sans doc tant qu'aucune des deux ne s'était produite. */
  abstract createUserProfile(uid: string, email: string, displayName?: string): Promise<void>;
  /** Écriture ponctuelle (pas de DebounceWriter, un simple bouton bascule) — seul champ client-writable de ce document, voir firestore.rules. */
  abstract setMapCollapsedByDefault(uid: string, value: boolean): Promise<void>;
  /** Écriture ponctuelle (même moule) — voir `UserProfileService.setDefaultCurrency`. */
  abstract setDefaultCurrency(uid: string, value: string): Promise<void>;
  /** Écriture ponctuelle (même moule) — ajoute un id à `onboarding.seenStepIds` (arrayUnion), voir `UserProfileService.markOnboardingStepSeen`. */
  abstract markOnboardingStepSeen(uid: string, stepId: string): Promise<void>;
  /** Écriture ponctuelle (même moule) — pose `onboarding.hasSeenOnboarding` à `true`, voir `UserProfileService.completeOnboardingIntro`. */
  abstract completeOnboardingIntro(uid: string): Promise<void>;
}
