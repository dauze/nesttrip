import { GeneratedActivityCandidate, Interest, TripAiPreferences } from './trip-generation.dto';

/** Nombre total d'activités proposées à l'aperçu (§2.5) — v1 fixe, pas de règle sur le nombre de jours (mode `activities_only`, aucun placement par jour). */
const PREVIEW_SIZE = 10;

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
 * de chaque intérêt, jusqu'à `PREVIEW_SIZE` — garde-fou anti-hallucination
 * respecté par construction : ne fait que sélectionner des `candidateId`
 * déjà présents dans le pool reçu, jamais de donnée inventée.
 */
export function selectActivitiesStub(
  candidates: GeneratedActivityCandidate[],
  _preferences: TripAiPreferences,
): GeneratedActivityCandidate[] {
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
  while (selected.length < PREVIEW_SIZE && interests.some((i) => (byInterest.get(i)?.length ?? 0) > round)) {
    for (const interest of interests) {
      const bucket = byInterest.get(interest) ?? [];
      const candidate = bucket[round];
      if (!candidate) continue;
      selected.push({ ...candidate, reason: `Choisi pour ton intérêt ${INTEREST_LABELS[interest]}` });
      if (selected.length >= PREVIEW_SIZE) break;
    }
    round++;
  }

  return selected;
}
