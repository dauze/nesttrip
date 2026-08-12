import { GeneratedActivityCandidate, GeneratedLodgingCandidate } from './trip-generation.dto';
import { PlannedActivity, PlannedLodging } from './plan-trip-llm';
import { GeocodedCity } from './geocode-city';

const ACTIVITY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.photos',
].join(',');

const LODGING_FIELD_MASK = ACTIVITY_FIELD_MASK;

/** Rayon de biais large (recherche par texte, pas par catégorie/proximité comme search-activities.ts) — juste de quoi désambiguïser un nom courant vers la bonne ville, pas une zone stricte (`locationBias`, pas `locationRestriction`). */
const BIAS_RADIUS_METERS = 20000;

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  photos?: { name: string }[];
}

/** Résout le centre de biais géographique d'une proposition (activité ou logement) sur les coordonnées de SA ville plutôt que systématiquement la destination principale — indispensable en mode multi-villes (`full_plan`), sinon `searchText` biaise tout vers la première ville même pour une activité assignée à une autre. */
function biasCenterFor(cityName: string, cities: GeocodedCity[]): { latitude: number; longitude: number } {
  const match = cities.find((c) => c.ville === cityName);
  return match ?? cities[0];
}

async function searchTextPlace(
  textQuery: string,
  center: { latitude: number; longitude: number },
  fieldMask: string,
  apiKey: string,
  logLabel: string,
): Promise<RawPlace | null> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'fr',
      maxResultCount: 1,
      locationBias: {
        circle: {
          center: { latitude: center.latitude, longitude: center.longitude },
          radius: BIAS_RADIUS_METERS,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`${logLabel} (${textQuery}) error:`, await response.text());
    return null;
  }

  const data = (await response.json()) as { places?: RawPlace[] };
  return data.places?.[0] ?? null;
}

async function resolveActivity(
  planned: PlannedActivity,
  cities: GeocodedCity[],
  apiKey: string,
): Promise<GeneratedActivityCandidate | null> {
  const place = await searchTextPlace(planned.title, biasCenterFor(planned.city, cities), ACTIVITY_FIELD_MASK, apiKey, 'enrichActivitiesWithPlaces');
  if (!place) return null;

  return {
    candidateId: place.id,
    placeId: place.id,
    title: place.displayName?.text ?? planned.title,
    ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
    ...(place.location?.latitude !== undefined ? { latitude: place.location.latitude } : {}),
    ...(place.location?.longitude !== undefined ? { longitude: place.location.longitude } : {}),
    photoRefs: (place.photos ?? []).slice(0, 3).map((p) => p.name),
    ...(place.rating !== undefined ? { rating: place.rating } : {}),
    interest: planned.interest,
    reason: planned.reason,
    excluded: false,
    ...(planned.day !== undefined ? { day: planned.day } : {}),
    estimatedDurationMinutes: planned.estimatedDurationMinutes,
    estimatedPriceEur: planned.estimatedPriceEur,
    ...(planned.timeOfDay ? { timeOfDay: planned.timeOfDay } : {}),
    ...(planned.suggestedStartMinutes !== undefined ? { suggestedStartMinutes: planned.suggestedStartMinutes } : {}),
    ...(planned.notes ? { notes: planned.notes } : {}),
  };
}

/**
 * Ancre chaque activité inventée par le LLM (plan-trip-llm.ts) dans un vrai
 * lieu Google (`places:searchText`, un appel par activité, en parallèle) —
 * récupère placeId/adresse/coordonnées/photos, la même donnée que l'ancien
 * pipeline obtenait via `searchNearby` mais résolue par nom plutôt que par
 * catégorie. Biais géographique résolu par ville (`planned.city`, voir
 * `biasCenterFor`) — nécessaire en mode multi-villes pour ne pas tout biaiser
 * vers la destination principale. Garde-fou anti-hallucination : une
 * activité que Google ne retrouve pas (aucun résultat) est silencieusement
 * écartée — si le lieu proposé par le LLM n'existe pas pour Google, autant ne
 * pas le proposer à l'utilisateur (même philosophie que le filtrage
 * `candidateId` inconnu dans select-activities-llm.ts, appliquée ici à
 * l'existence du lieu lui-même).
 *
 * Renvoie aussi `candidateIdByPlannedIndex` (même longueur/ordre que
 * `planned`, calculé AVANT le filtrage dédup ci-dessous) — permet à
 * `generate-trip.trigger.ts` de résoudre `PlannedGeneralNote.relatedActivityIndex`
 * (index dans `planned`, voir plan-trip-llm.ts) vers le `candidateId` stable
 * utilisé partout en aval, sans jamais avoir à recomparer un titre qui a pu
 * changer ci-dessus (`place.displayName?.text ?? planned.title`).
 */
export async function enrichActivitiesWithPlaces(
  planned: PlannedActivity[],
  cities: GeocodedCity[],
  apiKey: string,
): Promise<{ candidates: GeneratedActivityCandidate[]; candidateIdByPlannedIndex: (string | undefined)[] }> {
  const resolved = await Promise.all(planned.map((p) => resolveActivity(p, cities, apiKey)));
  const candidateIdByPlannedIndex = resolved.map((candidate) => candidate?.candidateId);

  const seenPlaceIds = new Set<string>();
  const candidates: GeneratedActivityCandidate[] = [];
  for (const candidate of resolved) {
    if (!candidate) continue;
    if (seenPlaceIds.has(candidate.placeId)) continue;
    seenPlaceIds.add(candidate.placeId);
    candidates.push(candidate);
  }
  return { candidates, candidateIdByPlannedIndex };
}

async function resolveLodging(
  planned: PlannedLodging,
  cities: GeocodedCity[],
  apiKey: string,
): Promise<GeneratedLodgingCandidate | null> {
  const place = await searchTextPlace(planned.title, biasCenterFor(planned.city, cities), LODGING_FIELD_MASK, apiKey, 'enrichLodgingWithPlaces');
  if (!place) return null;

  return {
    candidateId: place.id,
    placeId: place.id,
    title: place.displayName?.text ?? planned.title,
    ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
    ...(place.location?.latitude !== undefined ? { latitude: place.location.latitude } : {}),
    ...(place.location?.longitude !== undefined ? { longitude: place.location.longitude } : {}),
    photoRefs: (place.photos ?? []).slice(0, 3).map((p) => p.name),
    ...(place.rating !== undefined ? { rating: place.rating } : {}),
    city: planned.city,
    reason: planned.reason,
    excluded: false,
  };
}

/**
 * Même mécanique que `enrichActivitiesWithPlaces`, appliquée aux logements
 * proposés par le LLM (mode `full_plan`, voir `PlannedLodging`) — remplace la
 * recherche `searchNearby` triée par note (`search-lodging.ts`, désormais
 * repli uniquement) qui ignorait totalement les préférences utilisateur et
 * remontait systématiquement les grandes enseignes. Un logement que Google ne
 * retrouve pas est écarté (même garde-fou anti-hallucination).
 */
export async function enrichLodgingWithPlaces(
  planned: PlannedLodging[],
  cities: GeocodedCity[],
  apiKey: string,
): Promise<GeneratedLodgingCandidate[]> {
  const resolved = await Promise.all(planned.map((p) => resolveLodging(p, cities, apiKey)));
  return resolved.filter((c): c is GeneratedLodgingCandidate => c !== null);
}
