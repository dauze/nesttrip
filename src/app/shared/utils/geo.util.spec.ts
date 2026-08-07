import { haversineDistanceMeters } from './geo.util';

describe('haversineDistanceMeters', () => {
  it('retourne 0 pour 2 points identiques', () => {
    expect(haversineDistanceMeters(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it('calcule une distance cohérente entre Paris et Lyon (~390km à vol d\'oiseau)', () => {
    const distance = haversineDistanceMeters(48.8566, 2.3522, 45.764, 4.8357);
    expect(distance).toBeGreaterThan(390_000);
    expect(distance).toBeLessThan(400_000);
  });

  it('est symétrique (origine/destination interchangeables)', () => {
    const a = haversineDistanceMeters(48.8566, 2.3522, 45.764, 4.8357);
    const b = haversineDistanceMeters(45.764, 4.8357, 48.8566, 2.3522);
    expect(a).toBeCloseTo(b, 6);
  });
});
