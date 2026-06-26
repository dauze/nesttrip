import { Activity } from './trip-detail/trip-day-swiper/day-panel/activity-card/activity.model';
import { Info } from './trip-detail/trip-day-swiper/infos/info.models';

export type TripRole = 'owner' | 'editor' | 'viewer';
export interface Trip {
  id: string;
  ville: string;
  title: string;
  ownerId: string;
  members: Record<string, TripMember>;
  days: Day[];
  info: Info;
}

export interface Day {
  id: Date;
  activities: Activity[];
}


export interface TripMember {
  role: TripRole;
  email: string;
  displayName?: string;
}