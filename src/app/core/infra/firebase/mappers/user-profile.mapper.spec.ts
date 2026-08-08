import { userProfileFromFb } from './user-profile.mapper';
import { UserProfileFirebase } from '../models/user-profile.dto';

describe('user-profile.mapper', () => {
  const baseFb: UserProfileFirebase = {
    uid: 'user-1',
    email: 'user@example.com',
    companions: {},
  };

  describe('userProfileFromFb', () => {
    it('lit mapCollapsedByDefault tel quel', () => {
      expect(userProfileFromFb({ ...baseFb, mapCollapsedByDefault: true }).mapCollapsedByDefault).toBe(true);
      expect(userProfileFromFb({ ...baseFb, mapCollapsedByDefault: false }).mapCollapsedByDefault).toBe(false);
    });

    it('renvoie undefined si mapCollapsedByDefault est absent', () => {
      expect(userProfileFromFb(baseFb).mapCollapsedByDefault).toBeUndefined();
    });
  });

  describe('defaultCurrency', () => {
    it('lit defaultCurrency tel quel', () => {
      expect(userProfileFromFb({ ...baseFb, defaultCurrency: 'THB' }).defaultCurrency).toBe('THB');
    });

    it("renvoie undefined si l'utilisateur n'a jamais rien choisi explicitement", () => {
      expect(userProfileFromFb(baseFb).defaultCurrency).toBeUndefined();
    });
  });

  describe('onboarding', () => {
    it('lit hasSeenOnboarding/seenStepIds tels quels', () => {
      const onboarding = userProfileFromFb({
        ...baseFb,
        onboarding: { hasSeenOnboarding: true, seenStepIds: ['onboarding-immediate-1', 'onboarding-immediate-2'] },
      }).onboarding;

      expect(onboarding).toEqual({ hasSeenOnboarding: true, seenStepIds: ['onboarding-immediate-1', 'onboarding-immediate-2'] });
    });

    it("renvoie undefined tant que l'utilisateur n'a jamais rien vu du parcours nouvel utilisateur", () => {
      expect(userProfileFromFb(baseFb).onboarding).toBeUndefined();
    });

    it('retombe sur un tableau vide si seenStepIds est absent malgré un onboarding déjà présent', () => {
      const onboarding = userProfileFromFb({ ...baseFb, onboarding: { hasSeenOnboarding: false, seenStepIds: undefined as unknown as string[] } }).onboarding;
      expect(onboarding?.seenStepIds).toEqual([]);
    });
  });
});
