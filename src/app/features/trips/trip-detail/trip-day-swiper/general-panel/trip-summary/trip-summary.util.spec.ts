import { computeExpenseBreakdown, ExpenseItem } from './trip-summary.util';

describe('computeExpenseBreakdown', () => {
  const other = { icon: 'pi pi-ellipsis-h', colorVar: '--nt-logistic-other' };

  function item(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
    return { label: 'Item', icon: 'pi pi-star', colorVar: '--nt-activity-visite', amount: 10, ...overrides };
  }

  it('retourne un tableau vide si aucune dépense (total à 0)', () => {
    expect(computeExpenseBreakdown([], '€', 4, other)).toEqual([]);
  });

  it("n'ajoute pas d'anneau \"Autre\" quand il y a 4 dépenses ou moins", () => {
    const items = [item({ label: 'A', amount: 40 }), item({ label: 'B', amount: 30 }), item({ label: 'C', amount: 20 })];
    const result = computeExpenseBreakdown(items, '€', 4, other);

    expect(result.map((e) => e.label)).toEqual(['A', 'B', 'C']);
    expect(result.every((e) => e.label !== 'Autre')).toBe(true);
  });

  it('garde les 4 plus grosses dépenses triées par montant décroissant, et agrège le reste dans "Autre"', () => {
    const items = [
      item({ label: 'petit', amount: 5 }),
      item({ label: 'gros', amount: 100 }),
      item({ label: 'moyen1', amount: 40 }),
      item({ label: 'moyen2', amount: 35 }),
      item({ label: 'moyen3', amount: 30 }),
      item({ label: 'minuscule', amount: 2 }),
    ];
    const result = computeExpenseBreakdown(items, '€', 4, other);

    expect(result.map((e) => e.label)).toEqual(['gros', 'moyen1', 'moyen2', 'moyen3', 'Autre']);
    const autre = result.at(-1)!;
    expect(autre.count).toBeCloseTo(5 + 2);
    expect(autre.icon).toBe(other.icon);
    expect(autre.colorVar).toBe(other.colorVar);
  });

  it('calcule share proportionnellement au total GLOBAL (somme de tous les éléments, top affiché + "Autre")', () => {
    const items = [
      item({ label: 'A', amount: 10 }),
      item({ label: 'B', amount: 10 }),
      item({ label: 'C', amount: 10 }),
      item({ label: 'D', amount: 10 }),
      // La plus petite : termine forcément dans "Autre" (tri décroissant, top 4 = A/B/C/D).
      item({ label: 'E', amount: 5 }),
    ];
    // Total = 45. Top4 = A,B,C,D (10 chacun) + Autre = E (5).
    const result = computeExpenseBreakdown(items, '€', 4, other);

    expect(result.find((e) => e.label === 'A')!.share).toBeCloseTo(10 / 45);
    expect(result.find((e) => e.label === 'Autre')!.share).toBeCloseTo(5 / 45);
    // Les parts de tous les anneaux (top affiché + "Autre") couvrent 100% du total.
    expect(result.reduce((sum, e) => sum + e.share, 0)).toBeCloseTo(1);
  });

  it('formate valueLabel avec le symbole de devise fourni, 2 décimales', () => {
    const result = computeExpenseBreakdown([item({ amount: 12.5 })], '$', 4, other);
    expect(result[0].valueLabel).toBe('12.50 $');
  });
});
