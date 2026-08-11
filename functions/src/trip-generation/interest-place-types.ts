import { Interest } from './trip-generation.dto';

/**
 * Types Google Places ("Table A", API "New") interrogés par centre d'intérêt
 * pour la recherche élargie (§4.1 de process-creation-trip-ia.md). À
 * revérifier contre la table officielle avant mise en prod (aucun appel réel
 * n'a pu être testé dans cette session, pas de clé LLM/quota disponible) —
 * voir search-activities.ts.
 */
export const INTEREST_PLACE_TYPES: Record<Interest, string[]> = {
  museums: ['museum', 'art_gallery'],
  nature: ['park', 'tourist_attraction'],
  sport: ['gym', 'stadium'],
  food: ['restaurant', 'cafe'],
  nightlife: ['night_club', 'bar'],
  shopping: ['shopping_mall'],
  relaxation: ['spa'],
  offbeat: ['tourist_attraction'],
};
