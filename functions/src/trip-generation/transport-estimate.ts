import { GeneratedTransportSegment } from './trip-generation.dto';

const EARTH_RADIUS_KM = 6371;

/** Distance à vol d'oiseau (km) — aucune API de trajet inter-villes branchée en v1 (§6, fallback explicitement prévu). */
function haversineDistanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Estimation générique du trajet entre deux villes consécutives (§6 :
 * "prévoir ~2h de train Rome → Florence" si aucune API de trajet n'est
 * branchée) — seuils grossiers sur la distance à vol d'oiseau, jamais un
 * vrai horaire. En dessous de 400km : route/train (~80km/h effectifs,
 * arrêts/correspondances inclus) ; au-delà : vol (~2h incompressibles
 * comptées, embarquement compris).
 */
export function estimateTransportSegment(
  fromCity: { ville: string; latitude: number; longitude: number },
  toCity: { ville: string; latitude: number; longitude: number },
): GeneratedTransportSegment {
  const distanceKm = Math.round(haversineDistanceKm(fromCity, toCity));
  const isLongHaul = distanceKm > 400;
  const hours = isLongHaul ? 2 + distanceKm / 800 : 0.5 + distanceKm / 80;
  const roundedHours = Math.round(hours * 2) / 2;
  const mode = isLongHaul ? 'vol' : 'route/train';

  return {
    id: `${fromCity.ville}_${toCity.ville}`,
    fromCity: fromCity.ville,
    toCity: toCity.ville,
    distanceKm,
    estimatedLabel: `~${roundedHours}h estimées (${mode}) — estimation automatique, pas une recherche réelle`,
  };
}
