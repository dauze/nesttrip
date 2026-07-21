import { BookingStatus } from '@core/enums/booking.status';
import { DayActivityInstanceFirebase } from '../models/day-activity-instance.dto';
import { DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { bookingFromFb, bookingToFb } from './activity.mapper';

export function dayActivityInstanceFromFb(a: DayActivityInstanceFirebase): DayActivityInstance {
  return {
    ...a,
    price: a.price ?? { amount: 0, currency: 'EUR' },
    booking: a.booking ? bookingFromFb(a.booking) : { status: BookingStatus.NOT_NEEDED },
    notes: a.notes ?? '',
    startTime: a.startTime ? new Date(Number(a.startTime)) : new Date(),
    endTime: a.endTime ? new Date(Number(a.endTime)) : new Date(),
  };
}

export function dayActivityInstanceToFb(a: DayActivityInstance): DayActivityInstanceFirebase {
  return {
    ...a,
    booking: bookingToFb(a.booking),
    startTime: a.startTime ? String(a.startTime.getTime()) : '',
    endTime: a.endTime ? String(a.endTime.getTime()) : '',
  };
}
