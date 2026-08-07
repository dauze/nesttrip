import { computeExpenseBreakdown, ExpenseItem } from './trip-summary.util';

describe('computeExpenseBreakdown', () => {
  function item(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
    return { typeKey: 'activity:visite', label: 'Visite', icon: 'pi pi-star', colorVar: '--nt-activity-visite', amount: 10, ...overrides };
  }

  it('retourne un tableau vide si aucune dépense (total à 0)', () => {
    expect(computeExpenseBreakdown([], '€', 5)).toEqual([]);
  });

  it('additionne les dépenses de même type dans un seul anneau', () => {
    const items = [
      item({ typeKey: 'activity:visite', label: 'Visite', amount: 40 }),
      item({ typeKey: 'activity:visite', label: 'Visite', amount: 10 }),
      item({ typeKey: 'logistic:flight', label: 'Vol', icon: 'pi pi-send', colorVar: '--nt-logistic-flight', amount: 100 }),
    ];
    const result = computeExpenseBreakdown(items, '€', 5);

    expect(result).toEqual([
      { label: 'Vol', icon: 'pi pi-send', colorVar: '--nt-logistic-flight', count: 100, valueLabel: '100.00 €', share: 100 / 150 },
      { label: 'Visite', icon: 'pi pi-star', colorVar: '--nt-activity-visite', count: 50, valueLabel: '50.00 €', share: 50 / 150 },
    ]);
  });

  it('trie les types par montant décroissant, garde maxEntries - 1 individuellement, agrège le reste en "Autre"', () => {
    const items = [
      item({ typeKey: 'a', label: 'A', amount: 10 }),
      item({ typeKey: 'b', label: 'B', amount: 50 }),
      item({ typeKey: 'c', label: 'C', amount: 30 }),
      item({ typeKey: 'd', label: 'D', amount: 20 }),
    ];
    const result = computeExpenseBreakdown(items, '€', 2);

    // maxEntries=2 -> 1 seul type individuel (B, le plus gros), le reste (C+D+A=60) agrégé en "Autre".
    expect(result.map((e) => e.label)).toEqual(['B', 'Autre']);
    expect(result[1]).toEqual({
      label: 'Autre',
      icon: 'pi pi-ellipsis-h',
      colorVar: '--nt-logistic-other',
      count: 60,
      valueLabel: '60.00 €',
      share: 60 / 110,
    });
  });

  it('ne crée pas d\'entrée "Autre" si maxEntries - 1 types ou moins existent', () => {
    const items = [
      item({ typeKey: 'a', label: 'A', amount: 10 }),
      item({ typeKey: 'b', label: 'B', amount: 50 }),
      item({ typeKey: 'c', label: 'C', amount: 30 }),
    ];
    const result = computeExpenseBreakdown(items, '€', 5);

    expect(result.map((e) => e.label)).toEqual(['B', 'C', 'A']);
    expect(result.every((e) => e.label !== 'Autre')).toBe(true);
  });

  it('calcule share proportionnellement au total GLOBAL (tous types confondus, y compris ceux repliés dans "Autre")', () => {
    const items = [
      item({ typeKey: 'a', label: 'A', amount: 10 }),
      item({ typeKey: 'b', label: 'B', amount: 90 }),
    ];
    // Total = 100, maxEntries=2 -> topCount=1 ne garde que B individuellement, A replié dans "Autre" :
    // les deux shares restent calculées sur 100, pas sur B seul.
    const result = computeExpenseBreakdown(items, '€', 2);

    expect(result).toEqual([
      { label: 'B', icon: 'pi pi-star', colorVar: '--nt-activity-visite', count: 90, valueLabel: '90.00 €', share: 0.9 },
      { label: 'Autre', icon: 'pi pi-ellipsis-h', colorVar: '--nt-logistic-other', count: 10, valueLabel: '10.00 €', share: 0.1 },
    ]);
  });

  it('formate valueLabel avec le symbole de devise fourni, 2 décimales', () => {
    const result = computeExpenseBreakdown([item({ amount: 12.5 })], '$', 5);
    expect(result[0].valueLabel).toBe('12.50 $');
  });
});
