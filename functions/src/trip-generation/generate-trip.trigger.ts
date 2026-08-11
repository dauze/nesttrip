import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { SecretParam } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { searchActivityCandidates } from './search-activities';
import { searchLodgingCandidates } from './search-lodging';
import { selectActivitiesStub } from './select-activities-stub';
import { selectActivitiesLlm } from './select-activities-llm';
import { planTripLlm } from './plan-trip-llm';
import { enrichActivitiesWithPlaces, enrichLodgingWithPlaces } from './enrich-activities-with-places';
import { applyBudgetCap } from './apply-budget-cap';
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

/** Résultat du chemin primaire (`planTripLlm` + enrichissement) — `lodging` est `null` si ce chemin n'a rien produit d'exploitable pour les logements (hors `full_plan`, 0 logement retrouvé par Google...), auquel cas l'appelant retombe sur `buildLodging` (repli historique). */
interface ActivityGenerationResult {
  candidates: GeneratedActivityCandidate[];
  preview: GeneratedActivityCandidate[];
  lodging: { candidates: GeneratedLodgingCandidate[]; preview: GeneratedLodgingCandidate[] } | null;
}

/**
 * Génère les activités (et, en mode `full_plan`, les logements) du voyage —
 * 2 chemins :
 * - **Primaire** (`planTripLlm` + `enrichActivitiesWithPlaces`/
 *   `enrichLodgingWithPlaces`) : le LLM invente directement l'itinéraire (et
 *   le logement) à partir des préférences complètes (intérêts, texte libre,
 *   budget, villes), sans pool Google en entrée — Google Places n'intervient
 *   qu'après, pour ancrer chaque proposition dans un vrai lieu. Pris si
 *   `geminiApiKey` est configuré ET que ça produit au moins une activité une
 *   fois enrichie.
 * - **Repli** (`searchActivityCandidates` + `selectActivities`, chemin
 *   historique) : recherche Google par catégorie puis sélection LLM/stub
 *   dans ce pool ; logements repris séparément via `buildLodging`
 *   (`searchNearby` trié par note). Utilisé si le chemin primaire est
 *   indisponible (pas de clé, exception) ou n'a produit aucune activité
 *   exploitable après enrichissement — même philosophie §4.5 partout dans ce
 *   pipeline : ne jamais bloquer toute la génération pour l'échec d'une seule
 *   source.
 *
 * Note UX connue (chemin primaire) : `candidates === preview` (pas de pool
 * plus large que ce qui est proposé) — le bouton "Remplacer" de l'aperçu n'a
 * donc rien d'autre à piocher tant que l'activité/le logement vient de ce
 * chemin, contrairement au chemin de repli qui garde tout le pool
 * `searchNearby` comme réservoir. Accepté comme limitation connue plutôt que
 * doubler les appels Places pour générer un surplus de candidats jamais
 * montrés.
 */
async function generateActivities(
  doc: TripGenerationDoc,
  cities: GeocodedCity[],
  apiKey: string,
  geminiApiKey: string | undefined,
): Promise<ActivityGenerationResult | { error: string }> {
  const numDays = doc.preferences.assistanceLevel === 'activities_only' ? undefined : doc.tripDayDates.length;

  if (geminiApiKey) {
    try {
      const planned = await planTripLlm(doc.preferences, cities, numDays, geminiApiKey);
      const enriched = await enrichActivitiesWithPlaces(planned.activities, cities, apiKey);
      if (enriched.length > 0) {
        const enrichedLodging = planned.lodging.length > 0
          ? await enrichLodgingWithPlaces(planned.lodging, cities, apiKey)
          : [];
        return {
          candidates: enriched,
          preview: enriched,
          lodging: enrichedLodging.length > 0 ? { candidates: enrichedLodging, preview: enrichedLodging } : null,
        };
      }
      console.error('planTripLlm: 0 activité exploitable après enrichissement, repli sur recherche+sélection.');
    } catch (err) {
      console.error('planTripLlm error, repli sur recherche+sélection:', err);
    }
  }

  const activityResults = await Promise.all(
    cities.map((city) => searchActivityCandidates({ latitude: city.latitude, longitude: city.longitude }, doc.preferences.interests, apiKey)),
  );
  const candidates = dedupeByPlaceId(activityResults.flat());
  if (candidates.length === 0) return { error: 'Aucune activité trouvée autour de cette destination.' };

  const preview = await selectActivities(candidates, doc.preferences, numDays, geminiApiKey);
  return { candidates, preview, lodging: null };
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

        const activitiesResult = await generateActivities(doc, cities, apiKey, geminiApiKey?.value());
        if ('error' in activitiesResult) {
          await db.doc(`tripGenerations/${tripId}`).update({
            status: 'failed',
            error: activitiesResult.error,
            updatedAt: Date.now(),
          });
          return;
        }

        const { candidates } = activitiesResult;
        const preview = applyBudgetCap(activitiesResult.preview, doc.preferences.budgetMaxEur);

        // Logements proposés par le chemin primaire (pépites respectant freeText, voir plan-trip-llm.ts) préférés
        // s'ils existent ; `buildLodging` (searchNearby trié par note, ignore freeText) reste le repli.
        const { lodgingCandidates, lodgingPreview } = activitiesResult.lodging
          ? { lodgingCandidates: activitiesResult.lodging.candidates, lodgingPreview: activitiesResult.lodging.preview }
          : doc.preferences.assistanceLevel === 'full_plan'
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
