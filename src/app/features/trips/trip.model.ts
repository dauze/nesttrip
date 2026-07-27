import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { Reservation } from '@core/models/reservation.dto';
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
  reservations: Reservation[];
  /** Ordre manuel (drag-and-drop) des ids de `reservations`. */
  reservationOrder: string[];
  notes: Notes;
  placeId?: string;
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