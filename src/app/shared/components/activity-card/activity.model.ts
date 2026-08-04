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
  /** Format "HH:mm" — heure du jour uniquement, aucune date associée (voir activity-time.util.ts). */
  startTime?: string;
  /** Format "HH:mm" — heure du jour uniquement, aucune date associée (voir activity-time.util.ts). */
  endTime?: string;
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
  /** Format "HH:mm" — heure du jour uniquement, aucune date associée (voir activity-time.util.ts). */
  startTime?: string;
  /** Format "HH:mm" — heure du jour uniquement, aucune date associée (voir activity-time.util.ts). */
  endTime?: string;
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

/**
 * Écho en lecture seule d'une activité de la veille dont la plage horaire
 * franchit minuit (fin < début) — jamais stocké en base, jamais une vraie
 * `DayActivityInstance` : dérivé à l'affichage (voir `TripStore.getDayActivitiesWithEchoes`,
 * ROADMAP.md "Activités"). Le clic navigue vers l'instance réelle sur son
 * jour d'origine (voir `ActivityEchoCardComponent`, `DayActivityFocusService`).
 */
export interface ActivityEcho {
  kind: 'echo';
  originInstanceId: string;
  originDayId: Date;
  /** FK pool, pour icône/type/photo — même origine que `Activity.activityId`. */
  activityId: string;
  title: string;
  type: ActivityType;
  /** Toujours "00:00" : l'écho représente la portion de l'activité qui se poursuit après minuit. */
  startTime: string;
  endTime?: string;
  photoRefs: string[];
}

/** Entrée de la timeline d'un jour : soit une vraie activité, soit l'écho d'une activité de la veille (voir ActivityEcho). */
export type DayActivityEntry = { kind: 'activity'; activity: Activity } | ActivityEcho;

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
