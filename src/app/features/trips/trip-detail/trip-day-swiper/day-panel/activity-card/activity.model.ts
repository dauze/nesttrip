import {ActivityType} from '@core/enums/activites-type.enum';
import {BookingStatus} from '@core/enums/booking.status';

export interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  duration: number;
  startTime?: Date;
  endTime?: Date;
  price: Price;
  booking: Booking;
  notes: string;
  files: ActivityFile[];
    //Google
  placeId?: string;
  reviewCount?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  openingHours?: string[];
  phone?: string;
  website?: string;
  types?: string[];
  priceLevel?: number;
}

export interface Price {
  amount: number;
  currency: string;
}
export interface Booking {
  status: BookingStatus;
  deadline?: Date;
}

export interface ActivityFile {
  url: string;
  name: string;
  path: string;
}
