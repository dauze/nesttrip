import { PlaceSummary } from '@core/models/place.dto';
import { BookingFirebase, FileFirebase, PriceFirebase } from './activity.dto';

export type ReservationType = 'hotel' | 'flight' | 'carRental' | 'other';

export interface ReservationLinkFirebase {
  label: string;
  url: string;
}

export interface FlightStatusFirebase {
  state: 'scheduled' | 'onTime' | 'delayed' | 'cancelled' | 'landed';
  delayMinutes?: number;
  actualDepartureTime?: string;
  actualArrivalTime?: string;
}

export interface ReservationBaseFirebase {
  id: string;
  type: ReservationType;
  title: string;
  startDateTime?: string;
  endDateTime?: string;
  referenceNumber?: string;
  notes?: string;
  files?: FileFirebase[];
  links?: ReservationLinkFirebase[];
  price?: PriceFirebase;
  booking?: BookingFirebase;
}

export interface HotelReservationFirebase extends ReservationBaseFirebase {
  type: 'hotel';
  place?: PlaceSummary;
}

export interface FlightReservationFirebase extends ReservationBaseFirebase {
  type: 'flight';
  airline?: string;
  flightNumber?: string;
  departureAirport?: PlaceSummary;
  arrivalAirport?: PlaceSummary;
  status?: FlightStatusFirebase;
  statusFetchedAt?: string;
}

export interface CarRentalReservationFirebase extends ReservationBaseFirebase {
  type: 'carRental';
  company?: string;
  pickupPlace?: PlaceSummary;
  dropoffPlace?: PlaceSummary;
}

export interface OtherReservationFirebase extends ReservationBaseFirebase {
  type: 'other';
  place?: PlaceSummary;
}

export type ReservationFirebase =
  | HotelReservationFirebase
  | FlightReservationFirebase
  | CarRentalReservationFirebase
  | OtherReservationFirebase;
