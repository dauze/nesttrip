import { GeneratedActivityCandidate, Interest, Pace, TripAiPreferences } from './trip-generation.dto';

/** Nombre d'activités par jour selon le rythme choisi (§2.3) — utilisé en mode `activities_day`/`full_plan` (placement par jour). */
const ACTIVITIES_PER_DAY: Record<Pace, number> = { relaxed: 2, balanced: 3, intense: 4 };
/** Mode `activities_only` (pas de placement par jour) : nombre total fixe (§2.5), aucune notion de jour disponible pour calibrer autrement. */
const PREVIEW_SIZE_NO_DAYS = 10;
/** Ce chemin (fallback sans LLM) n'a aucune donnée réelle de durée/prix — valeur par défaut fixe faute de mieux, pas une estimation (voir select-activities-llm.ts pour la vraie estimation). */
const DEFAULT_DURATION_MINUTES = 120;
const DEFAULT_PRICE_EUR = 0;

const INTEREST_LABELS: Record<Interest, string> = {
  museums: 'musées',
  nature: 'nature & randonnée',
  sport: 'sport',
  food: 'gastronomie',
  nightlife: 'vie nocturne',
  shopping: 'shopping',
  relaxation: 'farniente',
  offbeat: 'insolite',
};

/**
 * Remplace l'appel LLM réel (tool use contraint au pool de candidats, voir
 * §4.2) — aucune clé fournie dans cette session (voir ROADMAP.md "Nouveau
 * voyage / IA"). Heuristique déterministe isolée derrière cette seule
 * fonction : brancher le vrai appel plus tard revient à remplacer UNIQUEMENT
 * ce fichier, la Cloud Function appelante (`generate-trip.trigger.ts`) n'a
 * pas à changer.
 *
 * Répartition round-robin par centre d'intérêt (jamais tous les résultats du
 * même intérêt d'affilée), triée par note Google décroissante à l'intérieur
 * de chaque intérêt — garde-fou anti-hallucination respecté par construction
 * (ne sélectionne que des `candidateId` déjà présents dans le pool reçu).
 *
 * `numDays` : `undefined` en mode `activities_only` (pas de placement, taille
 * fixe `PREVIEW_SIZE_NO_DAYS`, voir §2.5) ; sinon (`activities_day`/
 * `full_plan`) la taille cible est `rythme × numDays` (§2.3) et chaque item
 * sélectionné reçoit un `day` (0-based, cyclique sur l'ordre de sélection —
 * "ordre dans la journée uniquement", pas d'horaire précis, voir §6
 * recommandation v1).
 */
export function selectActivitiesStub(
  candidates: GeneratedActivityCandidate[],
  preferences: TripAiPreferences,
  numDays?: number,
): GeneratedActivityCandidate[] {
  const targetSize = numDays
    ? Math.min(candidates.length, ACTIVITIES_PER_DAY[preferences.pace ?? 'balanced'] * numDays)
    : Math.min(candidates.length, PREVIEW_SIZE_NO_DAYS);

  const byInterest = new Map<Interest, GeneratedActivityCandidate[]>();
  for (const candidate of candidates) {
    const bucket = byInterest.get(candidate.interest) ?? [];
    bucket.push(candidate);
    byInterest.set(candidate.interest, bucket);
  }
  for (const bucket of byInterest.values()) {
    bucket.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  const interests = [...byInterest.keys()];
  const selected: GeneratedActivityCandidate[] = [];
  let round = 0;
  while (selected.length < targetSize && interests.some((i) => (byInterest.get(i)?.length ?? 0) > round)) {
    for (const interest of interests) {
      const bucket = byInterest.get(interest) ?? [];
      const candidate = bucket[round];
      if (!candidate) continue;
      selected.push({
        ...candidate,
        reason: `Choisi pour ton intérêt ${INTEREST_LABELS[interest]}`,
        estimatedDurationMinutes: DEFAULT_DURATION_MINUTES,
        estimatedPriceEur: DEFAULT_PRICE_EUR,
      });
      if (selected.length >= targetSize) break;
    }
    round++;
  }

  if (!numDays) return selected;
  return selected.map((candidate, index) => ({ ...candidate, day: index % numDays }));
}
