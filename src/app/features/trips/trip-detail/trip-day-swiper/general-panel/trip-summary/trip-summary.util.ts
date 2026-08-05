import { RingChartEntry } from './activity-type-rings/activity-type-rings.component';

export interface ExpenseItem {
  label: string;
  icon: string;
  colorVar: string;
  amount: number;
}

/**
 * Top `maxEntries` plus grosses dépenses + un anneau "Autre" agrégeant le
 * reliquat (s'il y en a un) — voir `TripSummaryComponent.expenseBreakdown`
 * pour le contexte/la doc complète. Extrait en fonction pure (testable sans
 * `TestBed`, voir `nesttrip-testing`) : aucune dépendance à `TripFacade`, ne
 * fait que trier/agréger des montants déjà résolus.
 */
export function computeExpenseBreakdown(
  items: ExpenseItem[],
  currencySymbol: string,
  maxEntries: number,
  other: { icon: string; colorVar: string },
): RingChartEntry[] {
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  if (total === 0) return [];

  const toEntry = (item: ExpenseItem): RingChartEntry => ({
    label: item.label,
    icon: item.icon,
    colorVar: item.colorVar,
    count: item.amount,
    valueLabel: `${item.amount.toFixed(2)} ${currencySymbol}`,
    share: item.amount / total,
  });

  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  const entries = sorted.slice(0, maxEntries).map(toEntry);

  const rest = sorted.slice(maxEntries);
  if (rest.length) {
    const otherAmount = rest.reduce((sum, i) => sum + i.amount, 0);
    entries.push(toEntry({ label: 'Autre', icon: other.icon, colorVar: other.colorVar, amount: otherAmount }));
  }

  return entries;
}
