import { ActivityFirebase, BookingFirebase } from '../models/activity.dto';
import { PoolActivity, Booking } from '@app/shared/components/activity-card/activity.model';

export function activityFromFb(a: ActivityFirebase): PoolActivity {
  return {
    ...a,
    files: a.files ?? [],
    photoRefs: a.photoRefs ?? [],
  };
}

/** Firestore n'accepte aucune valeur `undefined` (même imbriquée) : les champs optionnels absents (activité sans lieu Google, ex. saisie en texte libre) sont omis plutôt qu'écrits à `undefined` — même règle que reservationToFb. */
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
