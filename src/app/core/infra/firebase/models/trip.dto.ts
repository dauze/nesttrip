import { Info } from '@app/features/trips/trip-detail/trip-day-swiper/infos/info.models';
import {ActivityFirebase} from './activity.dto';

export type TripRoleFireBase = 'owner' | 'editor' | 'viewer';

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
  days: Record<string, { activities: ActivityFirebase[] }>;
  info: Info;
  placeId?: string;
}
