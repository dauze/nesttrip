import {Info} from '@app/features/travel/infos/info.models';
import {ActivityFirebase} from './activity.dto';

export interface TravelFirebase {
  id: number;
  title: string;
  days: Record<string, { activities: ActivityFirebase[] }>;
  info: Info;
}
