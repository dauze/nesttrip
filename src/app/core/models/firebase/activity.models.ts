import { Timestamp } from "firebase/firestore";
import { ActivityType } from "../../enums/activites-type.enum";
import { BookingStatus } from "../../enums/booking.status";

export interface ActivityFirebase {
  id: number;
  title: string;
  type: ActivityType;
  duration: number;
  price: PriceFirebase;
  placeId: string;
  booking?: BookingFirebase;
  notes?: string;
  files?: FileFirebase[];
  website?: string;
  phone?: string;
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