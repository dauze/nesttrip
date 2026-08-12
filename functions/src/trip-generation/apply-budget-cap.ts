import { GeneratedActivityCandidate } from './trip-generation.dto';

/**
 * Fait rentrer le total des activités sous `budgetMaxEur` (préférence
 * utilisateur, voir TripAiPreferences.budgetMaxEur) en retirant les plus
 * chères en premier, jusqu'à repasser sous le plafond — appliqué au résultat
 * final quel que soit le chemin de génération (primaire ou repli, voir
 * generate-trip.trigger.ts). Best-effort assumé : l'estimation de prix vient
 * du LLM (ou d'un défaut fixe côté repli), pas d'une source garantie, et le
 * coût de trajet entre activités n'est jamais compté séparément — pas de
 * garantie stricte de respect du budget, juste un plafonnage a posteriori.
 * Ordre d'origine préservé (pas de tri de la liste retournée) ; `undefined` =
 * pas de budget renseigné, aucun filtrage.
 *
 * Limitation connue et acceptée : aucune awareness du mandat "déjeuner+dîner"
 * (voir plan-trip-llm.ts) — un repas mandaté, souvent l'activité la plus
 * chère du jour, peut être retiré en premier sous un budget serré. Corner
 * case rare (budgetMaxEur ET dépassement), pas de logique dédiée pour l'instant.
 */
export function applyBudgetCap(
  activities: GeneratedActivityCandidate[],
  budgetMaxEur: number | undefined,
): GeneratedActivityCandidate[] {
  if (budgetMaxEur === undefined) return activities;

  let total = activities.reduce((sum, a) => sum + (a.estimatedPriceEur ?? 0), 0);
  if (total <= budgetMaxEur) return activities;

  const excluded = new Set<string>();
  const byPriceDesc = [...activities].sort((a, b) => (b.estimatedPriceEur ?? 0) - (a.estimatedPriceEur ?? 0));
  for (const candidate of byPriceDesc) {
    if (total <= budgetMaxEur) break;
    excluded.add(candidate.candidateId);
    total -= candidate.estimatedPriceEur ?? 0;
  }

  return activities.filter((a) => !excluded.has(a.candidateId));
}
