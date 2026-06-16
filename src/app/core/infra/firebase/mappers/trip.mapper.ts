import { Trip } from '@app/features/trips/trip.model';
import { TripFirebase } from '../models/trip.dto';
import { activityFromFb, activityToFb } from './activity.mapper';

export function tripFromFb(data: TripFirebase): Trip {
  return {
    ...data,
    days: Object.entries(data.days).map(([key, value]) => ({
      id: new Date(Number(key)),
      activities: (value.activities ?? []).map((a) => activityFromFb(a)),
    })),
  };
}

export function tripToFb(data: Trip): TripFirebase {
  return {
    ...data,
    days: Object.fromEntries(
      data.days.map((d) => [
        String(d.id.getTime()),
        { activities: d.activities.map((a) => activityToFb(a)) },
      ]),
    ),
  };
}
