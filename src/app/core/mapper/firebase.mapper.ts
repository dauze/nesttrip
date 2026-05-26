import { Timestamp } from "firebase/firestore";
import { Activity, Booking } from "../models/dto/activity.interface";
import { Trip } from "../models/dto/trip.interface";
import { ActivityFirebase, BookingFirebase } from "../models/firebase/activity.models";
import { TripFirebase } from "../models/firebase/trip.models";
import { BookingStatus } from "../enums/booking.status";

  export function tripfromFb(data: TripFirebase): Trip {
    return {
      ...data,
      days: Object.entries(data.days).map(([key, value]) => ({
        id: new Date(Number(key)),
        activities: (value.activities ?? []).map(a => activityFromFb(a)),
      })),
    };
  }

   export function tripToFb(trip: Trip): TripFirebase {
    return {
      ...trip,
      days: Object.fromEntries(
        trip.days.map(d => [
          String(d.id.getTime()),
          { activities: d.activities.map(a => activityToFb(a)) },
        ])
      ),
    };
  }
  
export function activityFromFb(a: ActivityFirebase): Activity {
  return {
    ...a,
    price : a.price ?? { amount: 0, currency: 'EUR' },
    booking: a.booking ? bookingFromFb(a.booking) : { status: BookingStatus.NOT_NEEDED },
    files: a.files ?? [],
    notes : a.notes ?? '',
    website : a.website ?? '',
    phone : a.phone ?? ''
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
      deadline: b.deadline ? String(b.deadline.getTime()) : "",
    };
  }
