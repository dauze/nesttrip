import { BookingStatus } from '@core/enums/booking.status';

/** Activité "légère" de pool : identité Google + fichiers uniquement, jamais le form. */
export interface ActivityFirebase {
  id: string;
  title: string;
  files?: FileFirebase[];

  //Google
  placeId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photoRefs?: string[];
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
