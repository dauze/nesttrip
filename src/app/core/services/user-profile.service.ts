import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Observable } from 'rxjs';
import { UserProfileRepository } from '@core/infra/firebase/services/user-profile-repository';
import { AuthService } from './auth.service';
import { CollaborationService } from './collaboration.service';
import { Companion } from '@app/core/models/user-profile.dto';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly repo = inject(UserProfileRepository);
  private readonly authService = inject(AuthService);
  private readonly collaborationService = inject(CollaborationService);

  readonly companions = toSignal(
    this.repo
      .getUserProfile$(this.authService.getCurrentUser()!.uid)
      .pipe(map((profile) => Object.values(profile.companions))),
    { initialValue: [] as Companion[] },
  );

  removeCompanion(companionUid: string): Observable<{ success: boolean }> {
    return this.collaborationService.removeCompanion(companionUid);
  }
}
