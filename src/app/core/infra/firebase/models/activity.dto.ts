import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';

export interface ActivityFirebase {
  id: string;
  title: string;
  type: ActivityType;
  duration: number;
  price: PriceFirebase;
  booking?: BookingFirebase;
  notes?: string;
  files?: FileFirebase[];

  //Google
  placeId: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  openingHours?: string[];
  phone?: string;
  website?: string;
  types?: string[];
  priceLevel?: number;
  photos?: string[];
}
export interface PriceFirebase {
  amount: number;
  currency: string;
}
export interface BookingFirebase {
  status: BookingStatus;
  deadline?: string;
}

export interface FileFirebase {
  url: string;
  name: string;
  path: string;
}
