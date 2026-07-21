import { ActivityType } from '@core/enums/activites-type.enum';
import { PriceFirebase, BookingFirebase } from './activity.dto';

/** Instance réelle d'une activité rattachée à un jour : son propre form, indépendant des autres instances. */
export interface DayActivityInstanceFirebase {
  id: string;
  /** FK vers ActivityFirebase.id (pool) */
  activityId: string;
  type: ActivityType;
  duration: number;
  price: PriceFirebase;
  booking?: BookingFirebase;
  notes?: string;
  startTime?: string;
  endTime?: string;
}
