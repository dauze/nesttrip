import { PlaceSummary } from './place.dto';

export type ReservationType = 'hotel' | 'flight' | 'carRental' | 'other';

export interface ReservationFile {
  url: string;
  name: string;
  path: string;
}

export interface ReservationPrice {
  amount: number;
  currency: string;
}

export interface ReservationLink {
  label: string;
  url: string;
}

export interface FlightStatus {
  state: 'scheduled' | 'onTime' | 'delayed' | 'cancelled' | 'landed';
  delayMinutes?: number;
  actualDepartureTime?: Date;
  actualArrivalTime?: Date;
}

export interface ReservationBase {
  id: string;
  type: ReservationType;
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  referenceNumber?: string;
  notes?: string;
  files: ReservationFile[];
  links: ReservationLink[];
  price?: ReservationPrice;
}

export interface HotelReservation extends ReservationBase {
  type: 'hotel';
  place: PlaceSummary;
}

export interface FlightReservation extends ReservationBase {
  type: 'flight';
  airline: string;
  flightNumber: string;
  departureAirport: PlaceSummary;
  arrivalAirport: PlaceSummary;
  status?: FlightStatus;
  statusFetchedAt?: Date;
}

export interface CarRentalReservation extends ReservationBase {
  type: 'carRental';
  company: string;
  pickupPlace: PlaceSummary;
  dropoffPlace: PlaceSummary;
}

export interface OtherReservation extends ReservationBase {
  type: 'other';
  place?: PlaceSummary;
}

export type Reservation =
  | HotelReservation
  | FlightReservation
  | CarRentalReservation
  | OtherReservation;
