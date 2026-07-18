import { Activity } from '@app/shared/components/activity-card/activity.model';
import { Notes } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';

export type TripRole = 'owner' | 'editor';
export interface Trip {
  id: string;
  ville: string;
  title: string;
  ownerId: string;
  members: Record<string, TripMember>;
  days: Day[];
  activities: Activity[];
  notes: Notes;
  placeId?: string;
}

export interface Day {
  id: Date;
  activityIds: string[];
}


export interface TripMember {
  role: TripRole;
  email: string;
  displayName?: string;
}