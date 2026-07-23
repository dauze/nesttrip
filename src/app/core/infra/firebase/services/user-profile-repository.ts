import { Observable } from 'rxjs';
import { UserProfile } from '@app/core/models/user-profile.dto';

export abstract class UserProfileRepository {
  abstract getUserProfile$(uid: string): Observable<UserProfile>;
}
