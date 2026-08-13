/** `transit` (transports en commun, ROADMAP.md "UX / Interactions") : ajouté comme mode disponible en override manuel uniquement, voir `day-distance-gap/travel-mode.util.ts`. */
export type TravelMode = 'walk' | 'bike' | 'car' | 'transit';

/**
 * Id déterministe du doc `travelRoutes/{routeId}` (cache Firestore global,
 * voir `TravelRouteRepository`/`functions/src/trajets/get-trajet.handler.ts`
 * — la MÊME règle est dupliquée côté Cloud Function, ces deux copies doivent
 * rester identiques). `walk`/`bike` : les 2 placeId sont triés avant d'être
 * joints — un trajet à pied/vélo est quasi symétrique, ça divise par ~2 le
 * volume de paires stockées/calculées. `car`/`transit` : ordre
 * origine→destination conservé tel quel (trajet asymétrique — trafic pour
 * `car`, réseau/horaires de transport en commun pour `transit`).
 */
export function buildTravelRouteId(originPlaceId: string, destinationPlaceId: string, mode: TravelMode): string {
  if (mode === 'car' || mode === 'transit') return `${originPlaceId}_${destinationPlaceId}_${mode}`;
  const [a, b] = [originPlaceId, destinationPlaceId].sort();
  return `${a}_${b}_${mode}`;
}
