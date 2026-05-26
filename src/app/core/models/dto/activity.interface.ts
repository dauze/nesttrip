import { ActivityType } from "../../enums/activites-type.enum";
import { BookingStatus } from "../../enums/booking.status";

export interface Activity {
  id: number;
  title: string;
  type: ActivityType;
  duration: number;
  price: Price;
  placeId: string;
  booking: Booking;
  notes: string;
  files: ActivityFile[];
  website: string;
  phone: string;
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