import { GeneratedLodgingCandidate } from './trip-generation.dto';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.photos',
].join(',');

/** Nombre de candidats logement par ville (réservoir "Remplacer", §2.6) — plus restreint que les activités (§4.1 : "un seul logement par ville en v1"). */
const MAX_LODGING_PER_CITY = 5;
const SEARCH_RADIUS_METERS = 8000;

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  photos?: { name: string }[];
}

/**
 * Recherche de logements (mode `full_plan`, §6 : "Google Places propose
 * aussi des hôtels" — pas de réservation, données descriptives uniquement).
 * Même mécanique que `search-activities.ts` (`searchNearby`, type
 * `lodging`), un appel par ville (destination principale + villes
 * additionnelles géocodées, voir `geocode-city.ts`).
 */
export async function searchLodgingCandidates(
  city: { ville: string; latitude: number; longitude: number },
  apiKey: string,
): Promise<GeneratedLodgingCandidate[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ['lodging'],
      maxResultCount: MAX_LODGING_PER_CITY,
      languageCode: 'fr',
      locationRestriction: {
        circle: {
          center: { latitude: city.latitude, longitude: city.longitude },
          radius: SEARCH_RADIUS_METERS,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`searchLodging (${city.ville}) error:`, await response.text());
    return [];
  }

  const data = (await response.json()) as { places?: RawPlace[] };
  return (data.places ?? []).map((place) => ({
    candidateId: place.id,
    placeId: place.id,
    title: place.displayName?.text ?? '',
    ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
    ...(place.location?.latitude !== undefined ? { latitude: place.location.latitude } : {}),
    ...(place.location?.longitude !== undefined ? { longitude: place.location.longitude } : {}),
    photoRefs: (place.photos ?? []).slice(0, 3).map((p) => p.name),
    ...(place.rating !== undefined ? { rating: place.rating } : {}),
    city: city.ville,
    reason: `Logement à ${city.ville}`,
    excluded: false,
  }));
}
