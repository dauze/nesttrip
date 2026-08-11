import { AssistanceLevel, Interest, Pace, TravelerType } from '@app/features/trips/new-trip/trip-ai-preferences.model';
import { TripGenerationStatus } from '@app/features/trips/new-trip/trip-generation.model';

export interface TripAiPreferencesFirebase {
  assistanceLevel: AssistanceLevel;
  travelerType: TravelerType | null;
  pace: Pace | null;
  interests: Interest[];
  multiCity: boolean;
  cities: string[];
  freeText: string;
}

export interface GeneratedActivityCandidateFirebase {
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

export interface GeneratedLodgingCandidateFirebase {
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

export interface GeneratedTransportSegmentFirebase {
  id: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  estimatedLabel: string;
}

export interface TripGenerationFirebase {
  tripId: string;
  status: TripGenerationStatus;
  preferences: TripAiPreferencesFirebase;
  destination: { ville: string; placeId: string; latitude: number; longitude: number };
  tripDayDates: number[];
  candidates: GeneratedActivityCandidateFirebase[];
  preview: GeneratedActivityCandidateFirebase[];
  lodgingCandidates: GeneratedLodgingCandidateFirebase[];
  lodgingPreview: GeneratedLodgingCandidateFirebase[];
  transportSegments: GeneratedTransportSegmentFirebase[];
  error?: string;
  /** Epoch ms — même convention que `Price.frozenAt`/`Booking.deadline` côté activités, mais en `number` (pas de contrainte de type `map` Firestore ici). */
  createdAt: number;
  updatedAt: number;
}
