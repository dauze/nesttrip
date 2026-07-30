import { Trip } from '@app/features/trips/trip.model';
import { TripFirebase } from '../models/trip.dto';
import { activityFromFb, activityToFb } from './activity.mapper';
import { dayActivityInstanceFromFb, dayActivityInstanceToFb } from './day-activity-instance.mapper';
import { logisticFromFb, logisticToFb } from './logistic.mapper';

export function tripFromFb(data: TripFirebase): Trip {
  return {
    ...data,
    days: Object.entries(data.days).map(([key, value]) => ({
      id: new Date(Number(key)),
      activityIds: value.activityIds ?? [],
    })),
    activities: Object.values(data.activities ?? {}).map((a) => activityFromFb(a)),
    dayActivityInstances: Object.values(data.dayActivityInstances ?? {}).map((a) => dayActivityInstanceFromFb(a)),
    logistics: Object.values(data.logistics ?? {}).map((r) => logisticFromFb(r)),
  };
}

/** Firestore n'accepte aucune valeur `undefined` : `placeId`/`defaultCurrency` (optionnels, pas encore renseignés à la création) sont omis plutôt qu'écrits à `undefined` — même règle que activityToFb/logisticToFb. */
export function tripToFb(data: Trip): TripFirebase {
  const { placeId, defaultCurrency, ...rest } = data;
  return {
    ...rest,
    ...(placeId ? { placeId } : {}),
    ...(defaultCurrency ? { defaultCurrency } : {}),
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
    logistics: Object.fromEntries(
      data.logistics.map((r) => [r.id, logisticToFb(r)]),
    ),
  };
}
