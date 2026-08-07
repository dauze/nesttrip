import { ActivityFirebase, BookingFirebase, PriceFirebase } from '../models/activity.dto';
import { PoolActivity, Booking, Price } from '@app/shared/components/activity-card/activity.model';

export function activityFromFb(a: ActivityFirebase): PoolActivity {
  return {
    ...a,
    files: a.files ?? [],
    photoRefs: a.photoRefs ?? [],
  };
}

/** Firestore n'accepte aucune valeur `undefined` (même imbriquée) : les champs optionnels absents (activité sans lieu Google, ex. saisie en texte libre) sont omis plutôt qu'écrits à `undefined` — même règle que logisticToFb. */
export function activityToFb(a: PoolActivity): ActivityFirebase {
  return {
    id: a.id,
    title: a.title,
    files: a.files ?? [],
    photoRefs: a.photoRefs,
    ...(a.placeId ? { placeId: a.placeId } : {}),
    ...(a.address ? { address: a.address } : {}),
    ...(a.latitude !== undefined ? { latitude: a.latitude } : {}),
    ...(a.longitude !== undefined ? { longitude: a.longitude } : {}),
    ...(a.countryCode ? { countryCode: a.countryCode } : {}),
  };
}

export function priceFromFb(p: PriceFirebase): Price {
  return {
    amount: p.amount,
    currency: p.currency,
    ...(p.frozenRateToEur !== undefined ? { frozenRateToEur: p.frozenRateToEur } : {}),
    ...(p.frozenAmountEur !== undefined ? { frozenAmountEur: p.frozenAmountEur } : {}),
    ...(p.frozenAt ? { frozenAt: new Date(Number(p.frozenAt)) } : {}),
  };
}

/** Firestore n'accepte aucune valeur `undefined` (même imbriquée) : `frozenRateToEur`/`frozenAmountEur`/`frozenAt` (absents tant que le statut n'est jamais passé à `BOOKED`) sont omis plutôt qu'écrits à `undefined` — même règle que activityToFb/logisticToFb. */
export function priceToFb(p: Price): PriceFirebase {
  return {
    amount: p.amount,
    currency: p.currency,
    ...(p.frozenRateToEur !== undefined ? { frozenRateToEur: p.frozenRateToEur } : {}),
    ...(p.frozenAmountEur !== undefined ? { frozenAmountEur: p.frozenAmountEur } : {}),
    ...(p.frozenAt ? { frozenAt: String(p.frozenAt.getTime()) } : {}),
  };
}

export function bookingFromFb(b: BookingFirebase): Booking {
  return {
    ...b,
    deadline: b.deadline ? new Date(Number(b.deadline)) : new Date(),
  };
}

export function bookingToFb(b: Booking): BookingFirebase {
  return {
    ...b,
    deadline: b.deadline ? String(b.deadline.getTime()) : '',
  };
}
