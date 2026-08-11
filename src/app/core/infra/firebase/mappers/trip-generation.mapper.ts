import { GeneratedActivityCandidateFirebase, TripGenerationFirebase } from '../models/trip-generation.dto';
import { GeneratedActivityCandidate, TripGeneration } from '@app/features/trips/new-trip/trip-generation.model';

function candidateFromFb(c: GeneratedActivityCandidateFirebase): GeneratedActivityCandidate {
  return { ...c, photoRefs: c.photoRefs ?? [] };
}

/** Firestore n'accepte aucune valeur `undefined` — mêmes champs optionnels (`address`/`latitude`/`longitude`/`rating`) qu'`activityToFb`. */
function candidateToFb(c: GeneratedActivityCandidate): GeneratedActivityCandidateFirebase {
  return {
    candidateId: c.candidateId,
    placeId: c.placeId,
    title: c.title,
    photoRefs: c.photoRefs,
    interest: c.interest,
    reason: c.reason,
    excluded: c.excluded,
    ...(c.address ? { address: c.address } : {}),
    ...(c.latitude !== undefined ? { latitude: c.latitude } : {}),
    ...(c.longitude !== undefined ? { longitude: c.longitude } : {}),
    ...(c.rating !== undefined ? { rating: c.rating } : {}),
  };
}

export function tripGenerationFromFb(data: TripGenerationFirebase): TripGeneration {
  return {
    ...data,
    candidates: (data.candidates ?? []).map(candidateFromFb),
    preview: (data.preview ?? []).map(candidateFromFb),
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

/** Utilisé côté client uniquement à la création et à "Régénérer tout" (voir TripGenerationDataSource) — `error`/le contenu de `candidates`/`preview` sont toujours écrits par la Cloud Function (Admin SDK, hors mapper). */
export function tripGenerationToFb(data: TripGeneration): TripGenerationFirebase {
  return {
    tripId: data.tripId,
    status: data.status,
    preferences: data.preferences,
    destination: data.destination,
    candidates: data.candidates.map(candidateToFb),
    preview: data.preview.map(candidateToFb),
    createdAt: data.createdAt.getTime(),
    updatedAt: data.updatedAt.getTime(),
    ...(data.error ? { error: data.error } : {}),
  };
}
