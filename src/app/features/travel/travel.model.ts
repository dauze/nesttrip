import { Activity } from './day-panel/activity-card/activity.model';
import { Info } from './infos/info.models';

export interface Travel {
  id: number;
  title: string;
  days: Day[];
  info: Info;
}

export interface Day {
  id: Date;
  activities: Activity[];
}
