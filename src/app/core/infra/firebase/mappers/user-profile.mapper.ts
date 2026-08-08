import { UserProfile } from '@app/core/models/user-profile.dto';
import { UserProfileFirebase } from '../models/user-profile.dto';

export function userProfileFromFb(data: UserProfileFirebase): UserProfile {
  return {
    uid: data.uid,
    email: data.email,
    displayName: data.displayName ?? undefined,
    companions: Object.fromEntries(
      Object.entries(data.companions ?? {}).map(([uid, c]) => [
        uid,
        { uid: c.uid, email: c.email, displayName: c.displayName ?? undefined },
      ]),
    ),
    mapCollapsedByDefault: data.mapCollapsedByDefault,
    defaultCurrency: data.defaultCurrency,
    onboarding: data.onboarding
      ? { hasSeenOnboarding: data.onboarding.hasSeenOnboarding, seenStepIds: data.onboarding.seenStepIds ?? [] }
      : undefined,
  };
}
