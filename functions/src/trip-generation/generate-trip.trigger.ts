import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { SecretParam } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { searchActivityCandidates } from './search-activities';
import { searchLodgingCandidates } from './search-lodging';
import { selectActivitiesStub } from './select-activities-stub';
import { selectActivitiesLlm } from './select-activities-llm';
import { geocodeCity, GeocodedCity } from './geocode-city';
import { estimateTransportSegment } from './transport-estimate';
import { GeneratedActivityCandidate, GeneratedLodgingCandidate, TripAiPreferences, TripGenerationDoc } from './trip-generation.dto';

/**
 * Sélection des activités — un SEUL appel LLM par génération (voir doc de
 * classe ci-dessous), jamais par candidat ni par jour, le pool étant déjà
 * réduit en amont (§4.1, ~50-70 candidats max). Retombe sur le stub
 * déterministe (`selectActivitiesStub`) si `geminiApiKey` est absent (pas
 * encore configuré) OU si l'appel échoue (quota, réseau...) — même
 * philosophie que §4.5 : ne jamais faire échouer toute la génération pour
 * l'indisponibilité d'UNE seule source.
 */
async function selectActivities(
  candidates: GeneratedActivityCandidate[],
  preferences: TripAiPreferences,
  numDays: number | undefined,
  geminiApiKey: string | undefined,
): Promise<GeneratedActivityCandidate[]> {
  if (!geminiApiKey) return selectActivitiesStub(candidates, preferences, numDays);

  try {
    return await selectActivitiesLlm(candidates, preferences, numDays, geminiApiKey);
  } catch (err) {
    console.error('selectActivitiesLlm error, fallback sur le stub:', err);
    return selectActivitiesStub(candidates, preferences, numDays);
  }
}

/**
 * Résout la liste des villes à traiter (§4.1) : la destination principale
 * toujours, + les villes additionnelles (`preferences.cities`, simples
 * strings saisies au Lot 1 — aucune coordonnée capturée côté client)
 * géocodées ici (§4.2, mode `full_plan` multi-villes uniquement — inutile
 * d'appeler Google pour rien en mode `activities_only`/`activities_day`, qui
 * n'utilisent que la destination principale). Une ville non géocodable
 * (résultat Google vide) est silencieusement ignorée plutôt que de faire
 * échouer toute la génération (§4.5, "on ne bloque jamais toute la
 * génération pour l'échec d'une seule source").
 */
async function resolveCities(doc: TripGenerationDoc, apiKey: string): Promise<GeocodedCity[]> {
  const primary: GeocodedCity = {
    ville: doc.destination.ville,
    placeId: doc.destination.placeId,
    latitude: doc.destination.latitude,
    longitude: doc.destination.longitude,
  };

  if (doc.preferences.assistanceLevel !== 'full_plan' || !doc.preferences.multiCity || doc.preferences.cities.length === 0) {
    return [primary];
  }

  const geocoded = await Promise.all(doc.preferences.cities.map((name) => geocodeCity(name, apiKey)));
  return [primary, ...geocoded.filter((c): c is GeocodedCity => c !== null)];
}

/**
 * Pipeline de génération (process-creation-trip-ia.md §4) — déclenché par
 * toute écriture sur `tripGenerations/{tripId}` dont le document résultant a
 * `status: 'generating'` — couvre à la fois la création initiale (voir
 * `TripGenerationDataSource.create`) et "Régénérer tout"
 * (`TripGenerationDataSource.regenerate`), un seul trigger pour les deux.
 *
 * `onDocumentWritten` (pas `onDocumentCreated`) est nécessaire pour ça, mais
 * ce même trigger se redéclenche sur SES PROPRES écritures de fin (statut
 * `ready_for_preview`/`failed`) — le garde-fou `status !== 'generating'`
 * ci-dessous les ignore, pas de boucle infinie possible (cette fonction
 * n'écrit jamais `status: 'generating'` elle-même).
 *
 * 3 niveaux (`preferences.assistanceLevel`) :
 * - `activities_only` : pool d'activités seul, pas de `day` assigné.
 * - `activities_day` : pool d'activités + `day` assigné (répartition par
 *   rythme, voir `selectActivitiesStub`), pas de logement/transport.
 * - `full_plan` : idem + logements (1 par ville, §6) + estimations de
 *   trajet entre villes consécutives si multi-villes (§6, pas d'API de
 *   trajet inter-villes branchée en v1 — distance à vol d'oiseau).
 *
 * `geminiApiKey` optionnel : `undefined` tant que le secret `GEMINI_API_KEY`
 * n'est pas configuré (voir `index.ts`) — la génération reste alors sur le
 * stub déterministe, jamais bloquée pour autant (voir `selectActivities`).
 */
export function makeGenerateTripTrigger(googleApiKey: SecretParam, geminiApiKey?: SecretParam) {
  return onDocumentWritten(
    { document: 'tripGenerations/{tripId}', region: 'europe-west1', secrets: geminiApiKey ? [googleApiKey, geminiApiKey] : [googleApiKey] },
    async (event) => {
      const after = event.data?.after;
      if (!after?.exists) return;

      const doc = after.data() as TripGenerationDoc;
      if (doc.status !== 'generating') return;

      const tripId = event.params.tripId;
      const db = admin.firestore();
      const apiKey = googleApiKey.value();

      try {
        const cities = await resolveCities(doc, apiKey);

        const activityResults = await Promise.all(
          cities.map((city) => searchActivityCandidates({ latitude: city.latitude, longitude: city.longitude }, doc.preferences.interests, apiKey)),
        );
        const candidates = dedupeByPlaceId(activityResults.flat());

        if (candidates.length === 0) {
          await db.doc(`tripGenerations/${tripId}`).update({
            status: 'failed',
            error: 'Aucune activité trouvée autour de cette destination.',
            updatedAt: Date.now(),
          });
          return;
        }

        const numDays = doc.preferences.assistanceLevel === 'activities_only' ? undefined : doc.tripDayDates.length;
        const preview = await selectActivities(candidates, doc.preferences, numDays, geminiApiKey?.value());

        const { lodgingCandidates, lodgingPreview } = doc.preferences.assistanceLevel === 'full_plan'
          ? await buildLodging(cities, apiKey)
          : { lodgingCandidates: [] as GeneratedLodgingCandidate[], lodgingPreview: [] as GeneratedLodgingCandidate[] };

        const transportSegments = doc.preferences.assistanceLevel === 'full_plan' && cities.length > 1
          ? cities.slice(1).map((city, i) => estimateTransportSegment(cities[i], city))
          : [];

        await db.doc(`tripGenerations/${tripId}`).update({
          status: 'ready_for_preview',
          candidates,
          preview,
          lodgingCandidates,
          lodgingPreview,
          transportSegments,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error('generateTrip error:', err);
        await db.doc(`tripGenerations/${tripId}`).update({
          status: 'failed',
          error: 'Erreur serveur pendant la génération.',
          updatedAt: Date.now(),
        });
      }
    },
  );
}

function dedupeByPlaceId(candidates: GeneratedActivityCandidate[]): GeneratedActivityCandidate[] {
  const seen = new Set<string>();
  const result: GeneratedActivityCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.placeId)) continue;
    seen.add(candidate.placeId);
    result.push(candidate);
  }
  return result;
}

/** Un logement par ville dans l'aperçu (le mieux noté, §6) — le reste du pool récupéré reste disponible pour "Remplacer" (§2.6), filtré par ville côté client (voir `PreviewComponent`). Une ville dont la recherche échoue/est vide n'empêche pas les autres (§4.5). */
async function buildLodging(
  cities: GeocodedCity[],
  apiKey: string,
): Promise<{ lodgingCandidates: GeneratedLodgingCandidate[]; lodgingPreview: GeneratedLodgingCandidate[] }> {
  const perCity = await Promise.all(cities.map((city) => searchLodgingCandidates(city, apiKey)));
  const lodgingCandidates = perCity.flat();
  const lodgingPreview = perCity
    .map((list) => [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0])
    .filter((c): c is GeneratedLodgingCandidate => !!c);
  return { lodgingCandidates, lodgingPreview };
}
