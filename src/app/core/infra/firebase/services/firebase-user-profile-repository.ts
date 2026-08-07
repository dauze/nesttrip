import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserProfileRepository } from './user-profile-repository';
import { UserProfileDataSource } from './user-profile-data-source';
import { UserProfile } from '@app/core/models/user-profile.dto';

@Injectable({ providedIn: 'root' })
export class FirebaseUserProfileRepository extends UserProfileRepository {
  private readonly dataSource = inject(UserProfileDataSource);

  getUserProfile$(uid: string): Observable<UserProfile> {
    return this.dataSource.getUserProfile$(uid);
  }

  setMapCollapsedByDefault(uid: string, value: boolean): Promise<void> {
    return this.dataSource.setMapCollapsedByDefault(uid, value);
  }

  setDefaultCurrency(uid: string, value: string): Promise<void> {
    return this.dataSource.setDefaultCurrency(uid, value);
  }
}
