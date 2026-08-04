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
});
