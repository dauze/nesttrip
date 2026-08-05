import { RingChartEntry } from './activity-type-rings/activity-type-rings.component';

export interface ExpenseItem {
  /** Clé de regroupement par TYPE (ex. `activity:visite`, `logistic:flight`) — PAS l'id de l'élément : plusieurs dépenses du même type s'additionnent dans le même anneau. */
  typeKey: string;
  label: string;
  icon: string;
  colorVar: string;
  amount: number;
}

/**
 * Regroupe les dépenses par TYPE (vol, logement, activités, visites... —
 * ROADMAP.md "UX / Interactions", 2026-08-05, retour utilisateur : "je
 * voudrais que tu regroupes les 5 plus chères en fonction du type") et
 * retourne les `maxEntries` types dont la somme est la plus élevée. Pas
 * d'anneau "Autre" agrégeant le reliquat (contrairement à une version
 * précédente par élément individuel) : au-delà de `maxEntries`, les types
 * restants sont simplement ignorés — même convention que l'ancien
 * `typeBreakdown` (répartition par type d'activité). `share` de chaque
 * anneau retenu reste calculée sur le total GLOBAL (tous types confondus, y
 * compris ceux hors du top affiché), pas seulement la somme des anneaux
 * affichés. Extrait en fonction pure (testable sans `TestBed`, voir
 * `nesttrip-testing`) : aucune dépendance à `TripFacade`, ne fait que
 * regrouper/trier des montants déjà résolus.
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

  return groups
    .sort((a, b) => b.amount - a.amount)
    .slice(0, maxEntries)
    .map((group) => ({
      label: group.label,
      icon: group.icon,
      colorVar: group.colorVar,
      count: group.amount,
      valueLabel: `${group.amount.toFixed(2)} ${currencySymbol}`,
      share: group.amount / total,
    }));
}
