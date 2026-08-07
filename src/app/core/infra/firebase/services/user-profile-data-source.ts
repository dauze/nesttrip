import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { UserProfileFirebase } from '@app/core/infra/firebase/models/user-profile.dto';
import { userProfileFromFb } from '@app/core/infra/firebase/mappers/user-profile.mapper';
import { UserProfile } from '@app/core/models/user-profile.dto';

@Injectable({ providedIn: 'root' })
export class UserProfileDataSource {
  private readonly db = inject(FirebaseService).db;

  /** Écriture ponctuelle du seul champ client-writable de `users/{uid}` (voir firestore.rules) — pas de DebounceWriter, un simple bouton bascule. */
  setMapCollapsedByDefault(uid: string, value: boolean): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { mapCollapsedByDefault: value });
  }

  /** Écriture ponctuelle (même moule que `setMapCollapsedByDefault`) — simple picker dans les paramètres, pas de frappe continue. */
  setDefaultCurrency(uid: string, value: string): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { defaultCurrency: value });
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
