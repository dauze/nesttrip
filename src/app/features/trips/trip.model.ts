import { Activity } from '@app/shared/components/activity-card/activity.model';
import { Info } from './trip-detail/trip-day-swiper/infos/info.models';

export type TripRole = 'owner' | 'editor';
export interface Trip {
  id: string;
  ville: string;
  title: string;
  ownerId: string;
  members: Record<string, TripMember>;
  days: Day[];
  /**
   * Pool unique de TOUTES les activités du trip (source de vérité). Une
   * activité présente dans un `Day.activityIds` est une simple référence
   * vers une entrée de ce pool : il n'y a jamais de duplication, éditer une
   * activité ici ou depuis un jour modifie le même enregistrement.
   */
  activities: Activity[];
  info: Info;
  placeId?: string;
}

export interface Day {
  id: Date;
  /** Références (par id) vers des activités du pool `Trip.activities`. */
  activityIds: string[];
}


export interface TripMember {
  role: TripRole;
  email: string;
  displayName?: string;
}