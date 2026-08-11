import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { SecretParam } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { searchActivityCandidates } from './search-activities';
import { selectActivitiesStub } from './select-activities-stub';
import { TripGenerationDoc } from './trip-generation.dto';

/**
 * Pipeline de génération `activities_only` (process-creation-trip-ia.md §4) :
 * déclenché par toute écriture sur `tripGenerations/{tripId}` dont le
 * document résultant a `status: 'generating'` — couvre à la fois la création
 * initiale (voir `TripGenerationDataSource.create`) et "Régénérer tout"
 * (`TripGenerationDataSource.regenerate`), un seul trigger pour les deux.
 *
 * `onDocumentWritten` (pas `onDocumentCreated`) est nécessaire pour ça, mais
 * ce même trigger se redéclenche sur SES PROPRES écritures de fin (statut
 * `ready_for_preview`/`failed`) — le garde-fou `status !== 'generating'`
 * ci-dessous les ignore, pas de boucle infinie possible (cette fonction
 * n'écrit jamais `status: 'generating'` elle-même).
 */
export function makeGenerateTripTrigger(googleApiKey: SecretParam) {
  return onDocumentWritten(
    { document: 'tripGenerations/{tripId}', region: 'europe-west1', secrets: [googleApiKey] },
    async (event) => {
      const after = event.data?.after;
      if (!after?.exists) return;

      const doc = after.data() as TripGenerationDoc;
      if (doc.status !== 'generating') return;

      const tripId = event.params.tripId;
      const db = admin.firestore();

      try {
        const candidates = await searchActivityCandidates(
          { latitude: doc.destination.latitude, longitude: doc.destination.longitude },
          doc.preferences.interests,
          googleApiKey.value(),
        );

        if (candidates.length === 0) {
          await db.doc(`tripGenerations/${tripId}`).update({
            status: 'failed',
            error: "Aucune activité trouvée autour de cette destination.",
            updatedAt: Date.now(),
          });
          return;
        }

        const preview = selectActivitiesStub(candidates, doc.preferences);

        await db.doc(`tripGenerations/${tripId}`).update({
          status: 'ready_for_preview',
          candidates,
          preview,
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
