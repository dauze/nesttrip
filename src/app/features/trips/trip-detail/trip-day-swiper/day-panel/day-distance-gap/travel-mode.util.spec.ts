import { selectTravelMode, buildPlacePairKey } from './travel-mode.util';

describe('selectTravelMode', () => {
  const tiers = { tier1Mode: 'walk' as const, tier1MaxKm: 1.5, tier2Mode: 'bike' as const, tier2MaxKm: 8, tier3Mode: 'car' as const };

  it('retourne le mode du palier 1 sous son seuil', () => {
    expect(selectTravelMode(800, tiers)).toBe('walk');
    expect(selectTravelMode(1500, tiers)).toBe('walk');
  });

  it('retourne le mode du palier 2 entre les 2 seuils', () => {
    expect(selectTravelMode(1501, tiers)).toBe('bike');
    expect(selectTravelMode(8000, tiers)).toBe('bike');
  });

  it('retourne le mode du palier 3 ("sinon") au-dessus du 2e seuil', () => {
    expect(selectTravelMode(8001, tiers)).toBe('car');
    expect(selectTravelMode(50_000, tiers)).toBe('car');
  });

  it("respecte des modes de palier différents de l'ordre marche/vélo/voiture par défaut", () => {
    const custom = { tier1Mode: 'car' as const, tier1MaxKm: 5, tier2Mode: 'walk' as const, tier2MaxKm: 10, tier3Mode: 'bike' as const };
    expect(selectTravelMode(1000, custom)).toBe('car');
    expect(selectTravelMode(7000, custom)).toBe('walk');
    expect(selectTravelMode(20_000, custom)).toBe('bike');
  });
});

describe('buildPlacePairKey', () => {
  it('est indépendante du sens de la paire', () => {
    expect(buildPlacePairKey('a', 'b')).toBe(buildPlacePairKey('b', 'a'));
  });

  it('produit des clés distinctes pour des paires différentes', () => {
    expect(buildPlacePairKey('a', 'b')).not.toBe(buildPlacePairKey('a', 'c'));
  });
});
