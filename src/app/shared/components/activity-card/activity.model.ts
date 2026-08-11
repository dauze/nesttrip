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
  /** Code pays ISO 3166-1 alpha-2 du lieu Google sélectionné — voir `suggestedCurrencyForCountry` (src/specs/devise.md 3.1). */
  countryCode?: string;
  /** Absent = créée manuellement (comportement historique). `'ai_generated'` : issue du pipeline de génération IA (voir src/specs/process-creation-trip-ia.md §2.5/§4.3) — affiche un badge "Suggéré par IA", n'affecte jamais l'édition (une activité générée redevient une activité normale dès qu'elle est modifiée). */
  source?: 'ai_generated';
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
  /** Nombre de jours après le jour de placement où l'activité se termine réellement (0/absent = même jour) — voir `resolveEndDayOffset` (activity-time.util.ts) pour la résolution rétro-compatible, et `TripStore.getDayActivitiesWithEchoes` pour la génération des échos sur les jours intermédiaires/final. */
  endDayOffset?: number;
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
  /** Voir `DayActivityInstance.endDayOffset` — absent en contexte pool (identité de pool, pas de placement). */
  endDayOffset?: number;
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
  /** Voir `PoolActivity.source`. */
  source?: 'ai_generated';
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
  /** Taux `currency` -> EUR figé au passage du statut de réservation à `BOOKED` (pivot technique interne, voir currency-conversion.service.ts). Absent tant que non figé (recalcul dynamique). */
  frozenRateToEur?: number;
  /** Montant converti en EUR au moment du figeage (voir frozenRateToEur). */
  frozenAmountEur?: number;
  /** Instant du figeage. */
  frozenAt?: Date;
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
