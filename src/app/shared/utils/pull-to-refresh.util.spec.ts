import { computePullDistance, PULL_TO_REFRESH_MAX_DISTANCE } from './pull-to-refresh.util';

describe('computePullDistance', () => {
  it('returns 0 for a non-positive delta', () => {
    expect(computePullDistance(0)).toBe(0);
    expect(computePullDistance(-20)).toBe(0);
  });

  it('grows monotonically with the raw delta', () => {
    const small = computePullDistance(10);
    const medium = computePullDistance(50);
    const large = computePullDistance(200);
    expect(small).toBeGreaterThan(0);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
  });

  it('never reaches maxDistance, even for a large delta', () => {
    expect(computePullDistance(500, PULL_TO_REFRESH_MAX_DISTANCE)).toBeLessThan(PULL_TO_REFRESH_MAX_DISTANCE);
    expect(computePullDistance(500, PULL_TO_REFRESH_MAX_DISTANCE)).toBeGreaterThan(PULL_TO_REFRESH_MAX_DISTANCE * 0.99);
  });

  it('stays close to 1:1 for small deltas (resistance kicks in later)', () => {
    expect(computePullDistance(5, PULL_TO_REFRESH_MAX_DISTANCE)).toBeCloseTo(5, 0);
  });
});
