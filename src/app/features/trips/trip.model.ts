import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { Logistic } from '@core/models/logistic.dto';
import { Notes } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';

export type TripRole = 'owner' | 'editor';
export interface Trip {
  id: string;
  ville: string;
  title: string;
  ownerId: string;
  members: Record<string, TripMember>;
  days: Day[];
  /** Pool léger de toutes les activités du trip (identité + fichiers, pas de form). */
  activities: PoolActivity[];
  /** Instances réelles (form) rattachées aux jours, référencées par Day.activityIds. */
  dayActivityInstances: DayActivityInstance[];
  /** Réservations transverses (hôtel/vol/location/autre), indépendantes des jours. */
  logistics: Logistic[];
  notes: Notes;
  placeId?: string;
  /** Devise par défaut du voyage, préremplie à la création d'une nouvelle activité/réservation (voir ROADMAP.md "Devise") — n'affecte jamais les éléments déjà créés. */
  defaultCurrency?: string;
}

/**
 * Projection légère utilisée par le dashboard (`AccueilTripComponent`, voir
 * `TripStore._tripsResult`) : pas de `days`/`activities`/... (trop coûteux à
 * garder pour TOUS les trips d'un utilisateur en mémoire, voir CLAUDE.md
 * "état normalisé") — seulement `earliestDay`/`latestDay` (bornes de
 * l'intervalle de jours, voir ROADMAP.md "UX / Interactions", détection du
 * "voyage actif" à la connexion), calculées côté data source directement
 * depuis les clés du map Firestore `days`, sans mapper complet.
 */
export interface TripSummary extends Pick<Trip, 'id' | 'title' | 'ownerId'> {
  earliestDay?: Date;
  latestDay?: Date;
}

export interface Day {
  id: Date;
  /** Référence des DayActivityInstance.id, pas des activités de pool. */
  activityIds: string[];
}


export interface TripMember {
  role: TripRole;
  email: string;
  displayName?: string;
}