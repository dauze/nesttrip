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
});
