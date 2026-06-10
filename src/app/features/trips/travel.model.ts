import { Activity } from './trip-detail/day-panel/activity-card/activity.model';
import { Info } from './trip-detail/infos/info.models';

export interface Travel {
  id: string;
  title: string;
  days: Day[];
  info: Info;
}

export interface Day {
  id: Date;
  activities: Activity[];
}
