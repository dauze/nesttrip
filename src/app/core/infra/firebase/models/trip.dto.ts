
import { Notes } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import {ActivityFirebase} from './activity.dto';
import {DayActivityInstanceFirebase} from './day-activity-instance.dto';
import {LogisticFirebase} from './logistic.dto';
import {ExpenseFirebase} from './expense.dto';

export type TripRoleFireBase = 'owner' | 'editor';

/**
 * Sous-ensemble du type domaine `TravelMode` (`day-distance-gap/travel-mode.util.ts`) sans
 * `'transit'` (jamais un mode de palier) — redéfini localement plutôt qu'importé : ce DTO
 * (`core/infra/firebase`) ne doit pas dépendre d'un type de `features/`, voir CLAUDE.md.
 */
export type TravelTierModeFirebase = 'walk' | 'bike' | 'car';

export interface TripMember {
  role: TripRoleFireBase;
  email: string;
  displayName?: string;
}
export interface TripFirebase {
  id: string;
  ville: string;
  ownerId: string;
  members: Record<string, TripMember>;
  title: string;
  /** activityIds référence des DayActivityInstanceFirebase.id, pas des activités de pool. */
  days: Record<string, { activityIds: string[] }>;
  /** Pool léger de toutes les activités du trip, indexé par id (source de vérité pour l'identité). */
  activities: Record<string, ActivityFirebase>;
  /** Instances réelles (form) rattachées aux jours, indexées par instance id. */
  dayActivityInstances: Record<string, DayActivityInstanceFirebase>;
  /** Réservations transverses (hôtel/vol/location/autre), indépendantes du map `days`. */
  logistics: Record<string, LogisticFirebase>;
  /** Dépenses libres (non rattachées à une activité/logement/transport, ex. un smoothie), indépendantes du map `days` — voir src/specs/devise.md 3.4. */
  expenses: Record<string, ExpenseFirebase>;
  notes: Notes;
  placeId?: string;
  photoRef?: string;
  additionalCities?: string[];
  travelTiers?: {
    tier1Mode: TravelTierModeFirebase;
    tier1MaxKm: number;
    tier2Mode: TravelTierModeFirebase;
    tier2MaxKm: number;
    tier3Mode: TravelTierModeFirebase;
  };
  travelModeOverrides?: Record<string, TravelTierModeFirebase | 'transit'>;
}
