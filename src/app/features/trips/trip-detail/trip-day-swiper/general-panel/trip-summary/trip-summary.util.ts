import { RingChartEntry } from './activity-type-rings/activity-type-rings.component';

export interface ExpenseItem {
  /** Clé de regroupement par TYPE (ex. `activity:visite`, `logistic:flight`) — PAS l'id de l'élément : plusieurs dépenses du même type s'additionnent dans le même anneau. */
  typeKey: string;
  label: string;
  icon: string;
  colorVar: string;
  amount: number;
}

/** Icône/couleur de la 5ᵉ entrée fixe "Autre" (voir `computeExpenseBreakdown`) — même token neutre que `FREE_EXPENSE_META` (trip-summary.component.ts). */
const OTHER_META = { label: 'Autre', icon: 'pi pi-ellipsis-h', colorVar: '--nt-logistic-other' };

/**
 * Regroupe les dépenses par TYPE (vol, logement, activités, visites... —
 * ROADMAP.md "UX / Interactions", 2026-08-05, retour utilisateur : "je
 * voudrais que tu regroupes les 5 plus chères en fonction du type") et
 * retourne les `maxEntries - 1` types dont la somme est la plus élevée,
 * individuellement, plus une 5ᵉ entrée fixe "Autre" agrégeant tous les
 * types restants (ROADMAP.md "### UI" : "il faut que les 4 premier soient
 * les plus grand, et que le 5ime sois un libellé fixe 'Autre' qui regroupe
 * touts les autres dépenses" — remplace la version précédente qui
 * plafonnait simplement à `maxEntries` sans agréger le reliquat). Pas
 * d'entrée "Autre" si `maxEntries - 1` types ou moins existent (rien à
 * agréger). `share` de chaque entrée (top ou "Autre") reste calculée sur le
 * total GLOBAL (tous types confondus). Extrait en fonction pure (testable
 * sans `TestBed`, voir `nesttrip-testing`) : aucune dépendance à
 * `TripFacade`, ne fait que regrouper/trier des montants déjà résolus.
 */
export function computeExpenseBreakdown(
  items: ExpenseItem[],
  currencySymbol: string,
  maxEntries: number,
): RingChartEntry[] {
  const byType = new Map<string, { label: string; icon: string; colorVar: string; amount: number }>();
  for (const item of items) {
    const existing = byType.get(item.typeKey);
    if (existing) existing.amount += item.amount;
    else byType.set(item.typeKey, { label: item.label, icon: item.icon, colorVar: item.colorVar, amount: item.amount });
  }

  const groups = Array.from(byType.values());
  const total = groups.reduce((sum, g) => sum + g.amount, 0);
  if (total === 0) return [];

  const sorted = groups.sort((a, b) => b.amount - a.amount);
  const topCount = Math.max(0, maxEntries - 1);
  const top = sorted.slice(0, topCount);
  const rest = sorted.slice(topCount);

  const toEntry = (group: { label: string; icon: string; colorVar: string; amount: number }): RingChartEntry => ({
    label: group.label,
    icon: group.icon,
    colorVar: group.colorVar,
    count: group.amount,
    valueLabel: `${group.amount.toFixed(2)} ${currencySymbol}`,
    share: group.amount / total,
  });

  const entries = top.map(toEntry);
  if (rest.length > 0) {
    const otherAmount = rest.reduce((sum, g) => sum + g.amount, 0);
    entries.push(toEntry({ ...OTHER_META, amount: otherAmount }));
  }

  return entries;
}
