// Miroir serveur du contrat Angular (src/app/features/trips/new-trip/trip-ai-preferences.model.ts,
// trip-generation.model.ts, core/infra/firebase/models/trip-generation.dto.ts) — dupliqué plutôt
// qu'importé, même convention que functions/src/places/place.mapper.ts (aucun import croisé
// entre functions/ et l'app Angular dans ce repo).

export type AssistanceLevel = 'activities_only' | 'activities_day' | 'full_plan';
export type TravelerType = 'solo' | 'couple' | 'family' | 'friends';
export type Pace = 'relaxed' | 'balanced' | 'intense';
export type Interest = 'museums' | 'nature' | 'sport' | 'food' | 'nightlife' | 'shopping' | 'relaxation' | 'offbeat';

export interface TripAiPreferences {
  assistanceLevel: AssistanceLevel;
  travelerType: TravelerType | null;
  pace: Pace | null;
  interests: Interest[];
  multiCity: boolean;
  cities: string[];
  freeText: string;
}

export type TripGenerationStatus = 'generating' | 'ready_for_preview' | 'failed';

export interface GeneratedActivityCandidate {
  candidateId: string;
  placeId: string;
  title: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photoRefs: string[];
  rating?: number;
  interest: Interest;
  reason: string;
  excluded: boolean;
  day?: number;
}

export interface GeneratedLodgingCandidate {
  candidateId: string;
  placeId: string;
  title: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photoRefs: string[];
  rating?: number;
  city: string;
  reason: string;
  excluded: boolean;
}

export interface GeneratedTransportSegment {
  id: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  estimatedLabel: string;
}

export interface TripGenerationDoc {
  tripId: string;
  status: TripGenerationStatus;
  preferences: TripAiPreferences;
  destination: { ville: string; placeId: string; latitude: number; longitude: number };
  tripDayDates: number[];
  candidates: GeneratedActivityCandidate[];
  preview: GeneratedActivityCandidate[];
  lodgingCandidates: GeneratedLodgingCandidate[];
  lodgingPreview: GeneratedLodgingCandidate[];
  transportSegments: GeneratedTransportSegment[];
  error?: string;
  createdAt: number;
  updatedAt: number;
}
