
import { Notes } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import {ActivityFirebase} from './activity.dto';

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
  days: Record<string, { activityIds: string[] }>;
  /** Pool unique de toutes les activités du trip, indexé par id (source de vérité). */
  activities: Record<string, ActivityFirebase>;
  notes: Notes;
  placeId?: string;
}
