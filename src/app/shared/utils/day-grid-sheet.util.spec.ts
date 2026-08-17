import { computeExpandDurationMs, groupByMonth } from './day-grid-sheet.util';

describe('groupByMonth', () => {
  it('regroupe par mois avec un libellé "Mois Année" capitalisé', () => {
    const items = [
      { id: 'a', date: new Date('2026-08-01') },
      { id: 'b', date: new Date('2026-08-15') },
      { id: 'c', date: new Date('2026-09-02') },
    ];

    const groups = groupByMonth(items, (item) => item.date);

    expect(groups.map((g) => g.label)).toEqual(['Août 2026', 'Septembre 2026']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['c']);
  });

  it('renvoie un tableau vide si aucun élément', () => {
    expect(groupByMonth([], (item: { date: Date }) => item.date)).toEqual([]);
  });
});

describe('computeExpandDurationMs', () => {
  it('reste dans les bornes [300, 650] quelle que soit la hauteur d\'écran', () => {
    expect(computeExpandDurationMs(0)).toBeGreaterThanOrEqual(300);
    expect(computeExpandDurationMs(100000)).toBeLessThanOrEqual(650);
  });

  it('grandit avec la hauteur d\'écran, à vitesse constante', () => {
    const small = computeExpandDurationMs(600);
    const large = computeExpandDurationMs(1200);
    expect(large).toBeGreaterThan(small);
  });
});
