import {
  GeneratedActivityCandidateFirebase, GeneratedGeneralNoteFirebase, GeneratedLodgingCandidateFirebase,
  GeneratedTransportSegmentFirebase, TripGenerationFirebase,
} from '../models/trip-generation.dto';
import {
  GeneratedActivityCandidate, GeneratedGeneralNote, GeneratedLodgingCandidate,
  GeneratedTransportSegment, TripGeneration,
} from '@app/features/trips/new-trip/trip-generation.model';
import { omitUndefined } from './mapper.util';

function candidateFromFb(c: GeneratedActivityCandidateFirebase): GeneratedActivityCandidate {
  return { ...c, photoRefs: c.photoRefs ?? [] };
}

/**
 * Firestore n'accepte aucune valeur `undefined` — mêmes champs optionnels
 * (`address`/`latitude`/`longitude`/`rating`) qu'`activityToFb` (voir `omitUndefined`). `address`
 * garde un check `truthy` explicite (comportement d'origine) : une chaîne vide reste omise, pas
 * juste `undefined`.
 */
function candidateToFb(c: GeneratedActivityCandidate): GeneratedActivityCandidateFirebase {
  return {
    ...omitUndefined({
      candidateId: c.candidateId,
      placeId: c.placeId,
      title: c.title,
      photoRefs: c.photoRefs,
      interest: c.interest,
      reason: c.reason,
      excluded: c.excluded,
      latitude: c.latitude,
      longitude: c.longitude,
      rating: c.rating,
      day: c.day,
      estimatedDurationMinutes: c.estimatedDurationMinutes,
      estimatedPriceEur: c.estimatedPriceEur,
      timeOfDay: c.timeOfDay,
      suggestedStartMinutes: c.suggestedStartMinutes,
      notes: c.notes,
      bookingStatus: c.bookingStatus,
      bookingLeadDays: c.bookingLeadDays,
    }),
    ...(c.address ? { address: c.address } : {}),
  } as GeneratedActivityCandidateFirebase;
}

function lodgingFromFb(c: GeneratedLodgingCandidateFirebase): GeneratedLodgingCandidate {
  return { ...c, photoRefs: c.photoRefs ?? [] };
}

function lodgingToFb(c: GeneratedLodgingCandidate): GeneratedLodgingCandidateFirebase {
  return {
    ...omitUndefined({
      candidateId: c.candidateId,
      placeId: c.placeId,
      title: c.title,
      photoRefs: c.photoRefs,
      city: c.city,
      reason: c.reason,
      excluded: c.excluded,
      latitude: c.latitude,
      longitude: c.longitude,
      rating: c.rating,
      bookingStatus: c.bookingStatus,
      bookingLeadDays: c.bookingLeadDays,
    }),
    ...(c.address ? { address: c.address } : {}),
  } as GeneratedLodgingCandidateFirebase;
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
  return omitUndefined({
    id: n.id,
    title: n.title,
    type: n.type,
    points: n.points,
    excluded: n.excluded,
    relatedCandidateId: n.relatedCandidateId,
  }) as GeneratedGeneralNoteFirebase;
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
    ...omitUndefined({
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
      dayStartHour: data.dayStartHour,
      dayEndHour: data.dayEndHour,
    }),
    // Garde `truthy` (pas `!== undefined`, contrairement au reste) : un `error` vide ('') n'a pas
    // de sens à écrire, contrairement à `dayStartHour`/`dayEndHour` où `0` est une valeur valide.
    ...(data.error ? { error: data.error } : {}),
  } as TripGenerationFirebase;
}
