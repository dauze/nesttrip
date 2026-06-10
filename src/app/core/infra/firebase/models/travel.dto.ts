import { Info } from '@app/features/trips/trip-detail/infos/info.models';
import {ActivityFirebase} from './activity.dto';

export interface TravelFirebase {
  id: string;
  title: string;
  days: Record<string, { activities: ActivityFirebase[] }>;
  info: Info;
}
