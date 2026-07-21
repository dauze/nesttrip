import { ActivityFirebase, BookingFirebase } from '../models/activity.dto';
import { PoolActivity, Booking } from '@app/shared/components/activity-card/activity.model';

export function activityFromFb(a: ActivityFirebase): PoolActivity {
  return {
    ...a,
    files: a.files ?? [],
    photoRefs: a.photoRefs ?? [],
  };
}

export function activityToFb(a: PoolActivity): ActivityFirebase {
  return {
    ...a,
    files: a.files ?? [],
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
