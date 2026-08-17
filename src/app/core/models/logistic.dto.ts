import { PlaceSummary } from './place.dto';
import { Booking } from '@app/shared/components/activity-card/activity.model';

export type LogisticType = 'logement' | 'flight' | 'carRental' | 'train' | 'other';

/** Champ date/heure d'une réservation cliqué (voir `LogisticHeaderComponent.dateTimeClicked`/`LogisticCardComponent.onDateTimeClicked`). */
export type LogisticDateTimeField = 'startDate' | 'startTime' | 'endDate' | 'endTime';

export interface LogisticFile {
  url: string;
  name: string;
  path: string;
}

export interface LogisticPrice {
  amount: number;
  currency: string;
  /** Taux `currency` -> EUR figé au passage du statut de réservation à `BOOKED` (pivot technique interne, voir currency-conversion.service.ts). Absent tant que non figé (recalcul dynamique). */
  frozenRateToEur?: number;
  /** Montant converti en EUR au moment du figeage (voir frozenRateToEur). */
  frozenAmountEur?: number;
  /** Instant du figeage. */
  frozenAt?: Date;
}

export interface LogisticLink {
  label: string;
  url: string;
}

export interface FlightStatus {
  state: 'scheduled' | 'onTime' | 'delayed' | 'cancelled' | 'landed';
  delayMinutes?: number;
  actualDepartureTime?: Date;
  actualArrivalTime?: Date;
}

export interface LogisticBase {
  id: string;
  type: LogisticType;
  title: string;
  /** Absent tant que l'utilisateur n'a pas renseigné de date (voir LogisticsCreationService — jamais préremplie à la création, même principe que les heures d'activité). */
  startDateTime?: Date;
  endDateTime?: Date;
  referenceNumber?: string;
  notes?: string;
  files: LogisticFile[];
  links: LogisticLink[];
  price?: LogisticPrice;
  /** Statut "Résa" (à réserver/réservé/sans réservation/liste d'attente), même type que pour une activité. */
  booking: Booking;
}

/**
 * Les champs "lieu" (place/aéroports/agences) sont optionnels sur tous les
 * types : une réservation se crée d'abord vide (comme une activité, voir
 * LogisticsCreationService) puis se complète progressivement dans la
 * carte dépliée — jamais de champ obligatoire bloquant à la création.
 */
export interface LogementLogistic extends LogisticBase {
  type: 'logement';
  place?: PlaceSummary;
}

export interface FlightLogistic extends LogisticBase {
  type: 'flight';
  airline?: string;
  flightNumber?: string;
  departureAirport?: PlaceSummary;
  arrivalAirport?: PlaceSummary;
  status?: FlightStatus;
  statusFetchedAt?: Date;
}

export interface CarRentalLogistic extends LogisticBase {
  type: 'carRental';
  company?: string;
  pickupPlace?: PlaceSummary;
  dropoffPlace?: PlaceSummary;
}

export interface TrainLogistic extends LogisticBase {
  type: 'train';
  departurePlace?: PlaceSummary;
  arrivalPlace?: PlaceSummary;
}

export interface OtherLogistic extends LogisticBase {
  type: 'other';
  place?: PlaceSummary;
}

export type Logistic =
  | LogementLogistic
  | FlightLogistic
  | CarRentalLogistic
  | TrainLogistic
  | OtherLogistic;
