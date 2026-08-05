import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { UserProfileRepository } from '@core/infra/firebase/services/user-profile-repository';
import { AuthService } from './auth.service';
import { CollaborationService } from './collaboration.service';
import { Companion } from '@app/core/models/user-profile.dto';

@Injectable()
export class UserProfileService {
  private readonly repo = inject(UserProfileRepository);
  private readonly authService = inject(AuthService);
  private readonly collaborationService = inject(CollaborationService);

  // Un seul abonnement partagé au document `users/{uid}` (un seul `onSnapshot`),
  // dont `companions`/`mapCollapsedByDefault` sont dérivés — plutôt que deux
  // appels séparés à `getUserProfile$` qui ouvriraient deux écoutes Firestore
  // redondantes sur le même doc.
  private readonly profile = toSignal(
    this.repo.getUserProfile$(this.authService.getCurrentUser()!.uid),
  );

  readonly companions = computed(() => Object.values(this.profile()?.companions ?? {}) as Companion[]);
  /** Préférence UI carte repliée par défaut (ROADMAP.md "### UI") — `undefined` tant que le profil n'a pas encore été lu au moins une fois. */
  readonly mapCollapsedByDefault = computed(() => this.profile()?.mapCollapsedByDefault);

  removeCompanion(companionUid: string): Observable<{ success: boolean }> {
    return this.collaborationService.removeCompanion(companionUid);
  }

  /** Écriture ponctuelle (voir `UserProfileRepository.setMapCollapsedByDefault`) — fire-and-forget, pas de gestion d'erreur particulière (préférence UI mineure, pas de donnée critique). */
  setMapCollapsedByDefault(value: boolean): void {
    this.repo.setMapCollapsedByDefault(this.authService.getCurrentUser()!.uid, value).catch(() => undefined);
  }
}
