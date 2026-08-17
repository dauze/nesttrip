/**
 * Logique partagée par les calendriers "sheet montante" de l'app —
 * `DayPickerSheetComponent` (sélection simple) et `ActivityDayDispatchOverlayComponent`
 * (drag-and-drop, garde sa propre mécanique de bulle/hit-testing, non extraite ici : elle
 * dépend de refs DOM des cellules — `viewChildren('dayCell', ...)` — qui doivent rester dans le
 * template du composant qui les lit, Angular ne les résout pas à travers un enfant).
 */

export interface DayMonthGroup<T> {
  label: string;
  items: T[];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Regroupe des éléments datés par mois, libellé "Mois Année" capitalisé (locale fr-FR). */
export function groupByMonth<T>(items: T[], dateOf: (item: T) => Date): DayMonthGroup<T>[] {
  const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = capitalize(formatter.format(dateOf(item)));
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return [...groups.entries()].map(([label, groupItems]) => ({ label, items: groupItems }));
}

const EXPAND_DURATION_BASE_MS = 300;
const EXPAND_DURATION_PX_FACTOR_MS = 0.7;
const EXPAND_DURATION_MIN_MS = 300;
const EXPAND_DURATION_MAX_MS = 650;
/** Doit rester synchronisé avec `max-height: 50vh` sur les sheets (scss) — voir `computeExpandDurationMs`. */
export const EXPANDED_HEIGHT_VH_RATIO = 0.5;

/**
 * Durée (ms) de la montée/descente d'un calendrier sheet (croissance depuis 0 jusqu'à 50vh),
 * calculée à partir de la distance réelle (px) parcourue, pour rester à vitesse constante quelle
 * que soit la hauteur d'écran — voir `DayPickerSheetComponent.open`/
 * `ActivityDayDispatchOverlayComponent.openSheet`.
 */
export function computeExpandDurationMs(windowInnerHeight: number): number {
  const expandedHeightPx = windowInnerHeight * EXPANDED_HEIGHT_VH_RATIO;
  const duration = EXPAND_DURATION_BASE_MS + expandedHeightPx * EXPAND_DURATION_PX_FACTOR_MS;
  return Math.round(Math.min(EXPAND_DURATION_MAX_MS, Math.max(EXPAND_DURATION_MIN_MS, duration)));
}
