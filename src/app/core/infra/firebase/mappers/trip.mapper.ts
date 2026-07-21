import { Trip } from '@app/features/trips/trip.model';
import { TripFirebase } from '../models/trip.dto';
import { activityFromFb, activityToFb } from './activity.mapper';
import { dayActivityInstanceFromFb, dayActivityInstanceToFb } from './day-activity-instance.mapper';

export function tripFromFb(data: TripFirebase): Trip {
  return {
    ...data,
    days: Object.entries(data.days).map(([key, value]) => ({
      id: new Date(Number(key)),
      activityIds: value.activityIds ?? [],
    })),
    activities: Object.values(data.activities ?? {}).map((a) => activityFromFb(a)),
    dayActivityInstances: Object.values(data.dayActivityInstances ?? {}).map((a) => dayActivityInstanceFromFb(a)),
  };
}

export function tripToFb(data: Trip): TripFirebase {
  return {
    ...data,
    days: Object.fromEntries(
      data.days.map((d) => [
        String(d.id.getTime()),
        { activityIds: d.activityIds },
      ]),
    ),
    activities: Object.fromEntries(
      data.activities.map((a) => [a.id, activityToFb(a)]),
    ),
    dayActivityInstances: Object.fromEntries(
      data.dayActivityInstances.map((a) => [a.id, dayActivityInstanceToFb(a)]),
    ),
  };
}
