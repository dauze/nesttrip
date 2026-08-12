import {
  GeneratedActivityCandidateFirebase, GeneratedGeneralNoteFirebase, GeneratedLodgingCandidateFirebase,
  GeneratedTransportSegmentFirebase, TripGenerationFirebase,
} from '../models/trip-generation.dto';
import {
  GeneratedActivityCandidate, GeneratedGeneralNote, GeneratedLodgingCandidate,
  GeneratedTransportSegment, TripGeneration,
} from '@app/features/trips/new-trip/trip-generation.model';

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
    ...(c.day !== undefined ? { day: c.day } : {}),
    ...(c.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: c.estimatedDurationMinutes } : {}),
    ...(c.estimatedPriceEur !== undefined ? { estimatedPriceEur: c.estimatedPriceEur } : {}),
    ...(c.timeOfDay !== undefined ? { timeOfDay: c.timeOfDay } : {}),
    ...(c.suggestedStartMinutes !== undefined ? { suggestedStartMinutes: c.suggestedStartMinutes } : {}),
    ...(c.notes !== undefined ? { notes: c.notes } : {}),
  };
}

function lodgingFromFb(c: GeneratedLodgingCandidateFirebase): GeneratedLodgingCandidate {
  return { ...c, photoRefs: c.photoRefs ?? [] };
}

function lodgingToFb(c: GeneratedLodgingCandidate): GeneratedLodgingCandidateFirebase {
  return {
    candidateId: c.candidateId,
    placeId: c.placeId,
    title: c.title,
    photoRefs: c.photoRefs,
    city: c.city,
    reason: c.reason,
    excluded: c.excluded,
    ...(c.address ? { address: c.address } : {}),
    ...(c.latitude !== undefined ? { latitude: c.latitude } : {}),
    ...(c.longitude !== undefined ? { longitude: c.longitude } : {}),
    ...(c.rating !== undefined ? { rating: c.rating } : {}),
  };
}

function transportSegmentFromFb(s: GeneratedTransportSegmentFirebase): GeneratedTransportSegment {
  return { ...s };
}

function transportSegmentToFb(s: GeneratedTransportSegment): GeneratedTransportSegmentFirebase {
  return { ...s };
}

function generalNoteFromFb(n: GeneratedGeneralNoteFirebase): GeneratedGeneralNote {
  return { ...n };
}

function generalNoteToFb(n: GeneratedGeneralNote): GeneratedGeneralNoteFirebase {
  return {
    id: n.id,
    title: n.title,
    type: n.type,
    points: n.points,
    excluded: n.excluded,
    ...(n.relatedCandidateId !== undefined ? { relatedCandidateId: n.relatedCandidateId } : {}),
  };
}

export function tripGenerationFromFb(data: TripGenerationFirebase): TripGeneration {
  return {
    ...data,
    tripDayDates: data.tripDayDates ?? [],
    candidates: (data.candidates ?? []).map(candidateFromFb),
    preview: (data.preview ?? []).map(candidateFromFb),
    lodgingCandidates: (data.lodgingCandidates ?? []).map(lodgingFromFb),
    lodgingPreview: (data.lodgingPreview ?? []).map(lodgingFromFb),
    transportSegments: (data.transportSegments ?? []).map(transportSegmentFromFb),
    generalNotes: (data.generalNotes ?? []).map(generalNoteFromFb),
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

/** Utilisé côté client uniquement à la création et à "Régénérer tout" (voir TripGenerationDataSource) — `error`/le contenu de `candidates`/`preview`/`lodging*`/`transportSegments` sont toujours écrits par la Cloud Function (Admin SDK, hors mapper). */
export function tripGenerationToFb(data: TripGeneration): TripGenerationFirebase {
  return {
    tripId: data.tripId,
    status: data.status,
    preferences: data.preferences,
    destination: data.destination,
    tripDayDates: data.tripDayDates,
    candidates: data.candidates.map(candidateToFb),
    preview: data.preview.map(candidateToFb),
    lodgingCandidates: data.lodgingCandidates.map(lodgingToFb),
    lodgingPreview: data.lodgingPreview.map(lodgingToFb),
    transportSegments: data.transportSegments.map(transportSegmentToFb),
    generalNotes: data.generalNotes.map(generalNoteToFb),
    createdAt: data.createdAt.getTime(),
    updatedAt: data.updatedAt.getTime(),
    ...(data.dayStartHour !== undefined ? { dayStartHour: data.dayStartHour } : {}),
    ...(data.dayEndHour !== undefined ? { dayEndHour: data.dayEndHour } : {}),
    ...(data.error ? { error: data.error } : {}),
  };
}
