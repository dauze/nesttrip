import { Trip } from '@app/features/trips/trip.model';
import { TripFirebase } from '../models/trip.dto';
import { activityFromFb, activityToFb } from './activity.mapper';
import { dayActivityInstanceFromFb, dayActivityInstanceToFb } from './day-activity-instance.mapper';
import { logisticFromFb, logisticToFb } from './logistic.mapper';
import { expenseFromFb, expenseToFb } from './expense.mapper';

export function tripFromFb(data: TripFirebase): Trip {
  return {
    ...data,
    // Trié par clé (epoch ms, voir CLAUDE.md "Clés dynamiques Firestore") :
    // un champ `map` Firestore ne garantit PAS l'ordre de ses clés au retour
    // (contrairement à l'ordre d'écriture) — sans ce tri, `trip.days` (et donc
    // `TripStore._tripDays`, dont dépend `getDayActivitiesWithEchoes` pour
    // localiser "i jours avant" par position dans le tableau) pouvait se
    // retrouver mélangé après un simple aller-retour Firestore, cassant le
    // repérage chronologique — observé en conditions réelles (Playwright) :
    // l'ordre restait correct juste après création, puis se mélangeait dès la
    // première resynchronisation consécutive à une édition.
    days: Object.entries(data.days)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([key, value]) => ({
        id: new Date(Number(key)),
        activityIds: value.activityIds ?? [],
      })),
    activities: Object.values(data.activities ?? {}).map((a) => activityFromFb(a)),
    dayActivityInstances: Object.values(data.dayActivityInstances ?? {}).map((a) => dayActivityInstanceFromFb(a)),
    logistics: Object.values(data.logistics ?? {}).map((r) => logisticFromFb(r)),
    expenses: Object.values(data.expenses ?? {}).map((e) => expenseFromFb(e)),
  };
}

/** Firestore n'accepte aucune valeur `undefined` : `placeId`/`photoRef`/`travelTiers`/`travelModeOverrides` (optionnels, pas encore renseignés à la création) sont omis plutôt qu'écrits à `undefined` — même règle que activityToFb/logisticToFb. */
export function tripToFb(data: Trip): TripFirebase {
  const { placeId, photoRef, travelTiers, travelModeOverrides, ...rest } = data;
  return {
    ...rest,
    ...(placeId ? { placeId } : {}),
    ...(photoRef ? { photoRef } : {}),
    ...(travelTiers ? { travelTiers } : {}),
    ...(travelModeOverrides ? { travelModeOverrides } : {}),
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
    expenses: Object.fromEntries(
      data.expenses.map((e) => [e.id, expenseToFb(e)]),
    ),
  };
}
