import { BookingStatus } from '@core/enums/booking.status';
import { ActivityFirebase, BookingFirebase } from '../models/activity.dto';
import { Activity, Booking } from '@app/features/trips/trip-detail/trip-day-swiper/day-panel/activity-card/activity.model';

export function activityFromFb(a: ActivityFirebase): Activity {
  return {
    ...a,
    price: a.price ?? { amount: 0, currency: 'EUR' },
    booking: a.booking ? bookingFromFb(a.booking) : { status: BookingStatus.NOT_NEEDED },
    files: a.files ?? [],
    notes: a.notes ?? '',
    website: a.website ?? '',
    phone: a.phone ?? '',
  };
}

export function activityToFb(a: Activity): ActivityFirebase {
  return {
    ...a,
    booking: bookingToFb(a.booking),
    files: a.files ?? [],
  };
}

function bookingFromFb(b: BookingFirebase): Booking {
  return {
    ...b,
    deadline: b.deadline ? new Date(Number(b.deadline)) : new Date(),
  };
}

function bookingToFb(b: Booking): BookingFirebase {
  return {
    ...b,
    deadline: b.deadline ? String(b.deadline.getTime()) : '',
  };
}
