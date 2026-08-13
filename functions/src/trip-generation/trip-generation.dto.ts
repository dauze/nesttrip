// Miroir serveur du contrat Angular (src/app/features/trips/new-trip/trip-ai-preferences.model.ts,
// trip-generation.model.ts, core/infra/firebase/models/trip-generation.dto.ts) — dupliqué plutôt
// qu'importé, même convention que functions/src/places/place.mapper.ts (aucun import croisé
// entre functions/ et l'app Angular dans ce repo).

export type AssistanceLevel = 'activities_only' | 'activities_day' | 'full_plan';
export type TravelerType = 'solo' | 'couple' | 'family' | 'friends';
export type Pace = 'relaxed' | 'balanced' | 'intense';
export type Interest = 'museums' | 'nature' | 'sport' | 'food' | 'nightlife' | 'shopping' | 'relaxation' | 'offbeat';
/** Moment de la journée réaliste pour une activité (ouverture/ambiance) — voir plan-trip-llm.ts/select-activities-llm.ts, consommé par PreviewComponent pour placer l'horaire. */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TripAiPreferences {
  assistanceLevel: AssistanceLevel;
  travelerType: TravelerType | null;
  pace: Pace | null;
  interests: Interest[];
  multiCity: boolean;
  cities: string[];
  freeText: string;
  /** Budget max du voyage en euros (activités uniquement) — optionnel, best-effort (voir apply-budget-cap.ts). */
  budgetMaxEur?: number;
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
  /** Estimation LLM (ou défaut fixe côté stub, voir select-activities-stub.ts) — minutes. */
  estimatedDurationMinutes?: number;
  /** Estimation LLM (ou défaut fixe côté stub) — prix moyen par personne, euros. */
  estimatedPriceEur?: number;
  /** Détecté par le LLM à partir de sa connaissance du lieu (ouverture/ambiance) — absent côté stub. Défaut 'afternoon' appliqué à la consommation (PreviewComponent), pas ici. */
  timeOfDay?: TimeOfDay;
  /** Horaire de départ suggéré par le LLM (0-1439, minutes depuis 00:00) — chemin primaire uniquement (voir plan-trip-llm.ts). Prioritaire sur timeOfDay à la consommation (PreviewComponent.resolveDaySchedule). */
  suggestedStartMinutes?: number;
  /** Remarque pratique courte (réservation, espèces uniquement, tenue exigée...) — va dans DayActivityInstance.notes à la validation. */
  notes?: string;
  /** Réservation à l'avance jugée nécessaire par le LLM (concert, resto couru, visite à horaire...) — absent/'not_needed' = comportement historique (PreviewComponent applique NOT_NEEDED). */
  bookingStatus?: 'to_book' | 'not_needed';
  /** Délai conseillé avant la date de l'activité pour réserver, en jours — n'a de sens que si bookingStatus = 'to_book'. */
  bookingLeadDays?: number;
}

export type NoteType = 'TODO' | 'INFO';

/** Note générale de voyage générée par le LLM (packing list, choses à ne pas oublier...) — devient un `Item` du système de notes existant côté client à la validation (voir notes.model.ts). Chemin primaire uniquement (voir plan-trip-llm.ts). */
export interface GeneratedGeneralNote {
  id: string;
  title: string;
  type: NoteType;
  points: string[];
  excluded: boolean;
  /** = candidateId d'une GeneratedActivityCandidate — résolu dans generate-trip.trigger.ts depuis PlannedGeneralNote.relatedActivityIndex (voir plan-trip-llm.ts/enrich-activities-with-places.ts). Absent = note générale non liée. */
  relatedCandidateId?: string;
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
  /** Réservation à l'avance jugée nécessaire par le LLM — absent/'not_needed' = comportement historique. */
  bookingStatus?: 'to_book' | 'not_needed';
  /** Délai conseillé avant la date d'arrivée pour réserver, en jours — n'a de sens que si bookingStatus = 'to_book'. */
  bookingLeadDays?: number;
}

export interface GeneratedTransportSegment {
  id: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  estimatedLabel: string;
  /** 'flight' si long-courrier (voir transport-estimate.ts isLongHaul), 'road' sinon — pilote le type de logistique créée côté client (vol vs location de voiture). */
  mode: 'flight' | 'road';
  fromPlaceId?: string;
  fromLatitude?: number;
  fromLongitude?: number;
  toPlaceId?: string;
  toLatitude?: number;
  toLongitude?: number;
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
  /** Heure de début/fin de journée souhaitée (0-23), détectée par le LLM dans preferences.freeText — chemin primaire uniquement (voir plan-trip-llm.ts). Absent = comportement historique côté PreviewComponent. */
  dayStartHour?: number;
  dayEndHour?: number;
  /** Toujours renseigné (tableau, comme lodgingPreview/transportSegments) — [] sur le chemin de repli (voir generate-trip.trigger.ts). */
  generalNotes: GeneratedGeneralNote[];
  error?: string;
  createdAt: number;
  updatedAt: number;
}
