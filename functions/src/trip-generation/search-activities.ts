import { INTEREST_PLACE_TYPES } from './interest-place-types';
import { GeneratedActivityCandidate, Interest } from './trip-generation.dto';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.photos',
].join(',');

/** Nombre de candidats visés par centre d'intérêt (§4.1 : "pool large, ~20-30 candidats au total" — réparti sur 1 à 8 intérêts sélectionnés). */
const MAX_PER_INTEREST = 6;
/** Rayon de recherche autour de la destination (mètres) — v1 volontairement large, pas de notion de "zone de la ville" plus fine encore disponible. */
const SEARCH_RADIUS_METERS = 8000;

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  photos?: { name: string }[];
}

async function searchNearbyForInterest(
  interest: Interest,
  destination: { latitude: number; longitude: number },
  apiKey: string,
): Promise<GeneratedActivityCandidate[]> {
  const includedTypes = INTEREST_PLACE_TYPES[interest];

  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: MAX_PER_INTEREST,
      languageCode: 'fr',
      locationRestriction: {
        circle: {
          center: { latitude: destination.latitude, longitude: destination.longitude },
          radius: SEARCH_RADIUS_METERS,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`searchNearby (${interest}) error:`, await response.text());
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
    interest,
    reason: '',
    excluded: false,
  }));
}

/**
 * Recherche élargie (§4.1) : un appel `searchNearby` par centre d'intérêt
 * sélectionné (défaut si aucun : `offbeat`, pour ne jamais renvoyer un pool
 * vide), résultats concaténés — dédoublonnage par `placeId` (un même lieu
 * peut ressortir sous plusieurs types, ex. un musée aussi tagué
 * `tourist_attraction`).
 */
export async function searchActivityCandidates(
  destination: { latitude: number; longitude: number },
  interests: Interest[],
  apiKey: string,
): Promise<GeneratedActivityCandidate[]> {
  const effectiveInterests = interests.length ? interests : (['offbeat'] as Interest[]);

  const results = await Promise.all(
    effectiveInterests.map((interest) => searchNearbyForInterest(interest, destination, apiKey)),
  );

  const seen = new Set<string>();
  const candidates: GeneratedActivityCandidate[] = [];
  for (const list of results) {
    for (const candidate of list) {
      if (seen.has(candidate.placeId)) continue;
      seen.add(candidate.placeId);
      candidates.push(candidate);
    }
  }
  return candidates;
}
