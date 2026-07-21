
import { Notes } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import {ActivityFirebase} from './activity.dto';
import {DayActivityInstanceFirebase} from './day-activity-instance.dto';

export type TripRoleFireBase = 'owner' | 'editor';

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
  notes: Notes;
  placeId?: string;
}
