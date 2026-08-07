import { Observable } from 'rxjs';
import { UserProfile } from '@app/core/models/user-profile.dto';

export abstract class UserProfileRepository {
  abstract getUserProfile$(uid: string): Observable<UserProfile>;
  /** Écriture ponctuelle (pas de DebounceWriter, un simple bouton bascule) — seul champ client-writable de ce document, voir firestore.rules. */
  abstract setMapCollapsedByDefault(uid: string, value: boolean): Promise<void>;
  /** Écriture ponctuelle (même moule) — voir `UserProfileService.setDefaultCurrency`. */
  abstract setDefaultCurrency(uid: string, value: string): Promise<void>;
}
