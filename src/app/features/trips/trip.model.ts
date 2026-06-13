import { Activity } from './trip-detail/day-panel/activity-card/activity.model';
import { Info } from './trip-detail/infos/info.models';

export type TripRole = 'owner' | 'editor' | 'viewer';
export interface Trip {
  id: string;
  ville: string;
  title: string;
  ownerId: string;
  members: Record<string, TripRole>;
  days: Day[];
  info: Info;
}

export interface Day {
  id: Date;
  activities: Activity[];
}
