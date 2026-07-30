import { PlaceSummary } from '@core/models/place.dto';
import { BookingFirebase, FileFirebase, PriceFirebase } from './activity.dto';

export type LogisticType = 'logement' | 'flight' | 'carRental' | 'other';

export interface LogisticLinkFirebase {
  label: string;
  url: string;
}

export interface FlightStatusFirebase {
  state: 'scheduled' | 'onTime' | 'delayed' | 'cancelled' | 'landed';
  delayMinutes?: number;
  actualDepartureTime?: string;
  actualArrivalTime?: string;
}

export interface LogisticBaseFirebase {
  id: string;
  type: LogisticType;
  title: string;
  startDateTime?: string;
  endDateTime?: string;
  referenceNumber?: string;
  notes?: string;
  files?: FileFirebase[];
  links?: LogisticLinkFirebase[];
  price?: PriceFirebase;
  booking?: BookingFirebase;
}

export interface LogementLogisticFirebase extends LogisticBaseFirebase {
  type: 'logement';
  place?: PlaceSummary;
}

export interface FlightLogisticFirebase extends LogisticBaseFirebase {
  type: 'flight';
  airline?: string;
  flightNumber?: string;
  departureAirport?: PlaceSummary;
  arrivalAirport?: PlaceSummary;
  status?: FlightStatusFirebase;
  statusFetchedAt?: string;
}

export interface CarRentalLogisticFirebase extends LogisticBaseFirebase {
  type: 'carRental';
  company?: string;
  pickupPlace?: PlaceSummary;
  dropoffPlace?: PlaceSummary;
}

export interface OtherLogisticFirebase extends LogisticBaseFirebase {
  type: 'other';
  place?: PlaceSummary;
}

export type LogisticFirebase =
  | LogementLogisticFirebase
  | FlightLogisticFirebase
  | CarRentalLogisticFirebase
  | OtherLogisticFirebase;
