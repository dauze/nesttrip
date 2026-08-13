import { TravelTiers } from '@app/features/trips/trip.model';

/** `transit` (transports en commun, ROADMAP.md "UX / Interactions") n'est jamais choisi par `selectTravelMode` ci-dessous (les 3 paliers restent walk/bike/car, voir `TravelTiers`) — uniquement disponible en override manuel d'une paire de lieux, voir `DayDistanceGapComponent`. */
export type TravelMode = 'walk' | 'bike' | 'car' | 'transit';

/**
 * Sélection auto du mode de trajet affiché entre 2 activités, à partir de la
 * distance à vol d'oiseau (gratuite, voir `haversineDistanceMeters`) et des
 * 3 paliers réglables par voyage (mode + seuil choisis par l'utilisateur,
 * voir `TravelTiers`) — jamais un appel réseau juste pour "voir" quel mode
 * utiliser (voir ROADMAP.md "Activités"/"UX / Interactions").
 */
export function selectTravelMode(distanceMeters: number, tiers: TravelTiers): TravelMode {
  const distanceKm = distanceMeters / 1000;
  if (distanceKm <= tiers.tier1MaxKm) return tiers.tier1Mode;
  if (distanceKm <= tiers.tier2MaxKm) return tiers.tier2Mode;
  return tiers.tier3Mode;
}

/**
 * Clé stable pour une paire de lieux, indépendante du sens (une paire
 * A/B et B/A désignent la même "zone" visuelle entre 2 activités) — utilisée
 * pour stocker/lire un override manuel de mode (`Trip.travelModeOverrides`).
 */
export function buildPlacePairKey(placeIdA: string, placeIdB: string): string {
  return [placeIdA, placeIdB].sort().join('_');
}
