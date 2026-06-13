import { Info } from '@app/features/trips/trip-detail/infos/info.models';
import {ActivityFirebase} from './activity.dto';

export type TripRoleFireBase = 'owner' | 'editor' | 'viewer';
export interface TripFirebase {
  id: string;
  ville: string;
  ownerId: string;
  members: Record<string, TripRoleFireBase>;
  title: string;
  days: Record<string, { activities: ActivityFirebase[] }>;
  info: Info;
}
