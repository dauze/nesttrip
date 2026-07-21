import {ActivityType} from '@core/enums/activites-type.enum';
import {BookingStatus} from '@core/enums/booking.status';

/** Activité "légère" de pool : identité Google + fichiers uniquement, jamais le form. */
export interface PoolActivity {
  id: string;
  title: string;
  files: ActivityFile[];
  //Google
  placeId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photoRefs: string[];
}

/** Instance réelle d'une activité rattachée à un jour : son propre form, indépendant des autres instances. */
export interface DayActivityInstance {
  id: string;
  /** FK vers PoolActivity.id */
  activityId: string;
  type: ActivityType;
  duration: number;
  startTime?: Date;
  endTime?: Date;
  price: Price;
  booking: Booking;
  notes: string;
}

/**
 * Vue composée consommée par l'UI (carte, form, fichiers...) : fusion d'une PoolActivity et,
 * en contexte jour, de la DayActivityInstance qui la rattache à ce jour.
 * `id` = instanceId en contexte jour, poolId en contexte pool (auto-référencé par `activityId`).
 */
export interface Activity {
  id: string;
  /** FK vers l'activité de pool ; toujours renseigné, y compris en contexte pool (auto-référence). */
  activityId: string;
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
  address?: string;
  latitude?: number;
  longitude?: number;
  photoRefs: string[];
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
