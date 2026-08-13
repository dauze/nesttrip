import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';

export interface ActivityTypeMeta {
  label: string;
  icon: string;
  /** Variable CSS (`--nt-activity-*`, voir tokens.scss) pilotant la couleur d'identité du type — remplace la couleur par statut de réservation sur le bord gauche des cartes (voir ROADMAP.md "UX / Interactions"). */
  colorVar: string;
}

export interface BookingStatusMeta {
  label: string;
  className: string;
}

export const ACTIVITY_TYPE_META: Record<ActivityType, ActivityTypeMeta> = {
  [ActivityType.REPAS]: {label: 'Repas', icon: 'nt-icon-meal', colorVar: '--nt-activity-repas'},
  [ActivityType.TRANSPORT]: {label: 'Transport', icon: 'pi pi-car', colorVar: '--nt-activity-transport'},
  [ActivityType.HEBERGEMENT]: {label: 'Hébergement', icon: 'pi pi-home', colorVar: '--nt-activity-hebergement'},
  [ActivityType.VISITE]: {label: 'Visite', icon: 'pi pi-map-marker', colorVar: '--nt-activity-visite'},
  [ActivityType.ACTIVITE]: {label: 'Activité', icon: 'pi pi-bolt', colorVar: '--nt-activity-activite'},
  [ActivityType.SHOPPING]: {label: 'Shopping', icon: 'pi pi-shopping-bag', colorVar: '--nt-activity-shopping'},
  [ActivityType.DETENTE]: {label: 'Détente', icon: 'pi pi-heart', colorVar: '--nt-activity-detente'},
  [ActivityType.EVENEMENT]: {label: 'Événement', icon: 'pi pi-calendar', colorVar: '--nt-activity-evenement'},
  [ActivityType.NATURE]: {label: 'Nature', icon: 'pi pi-sun', colorVar: '--nt-activity-nature'},
  [ActivityType.SOINS]: {label: 'Soins', icon: 'pi pi-plus-circle', colorVar: '--nt-activity-soins'},
};

export const BOOKING_STATUS_META: Record<BookingStatus, {label: string; className: string;}> = {
  [BookingStatus.TO_BOOK]: {label: 'À réserver', className: 'to_book'},
  [BookingStatus.BOOKED]: {label: 'Réservé', className: 'booked'},
  [BookingStatus.NOT_NEEDED]: {label: 'Sans réservation', className: 'not_needed'},
  [BookingStatus.WAITLIST]: {label: 'Liste d\'attente', className: 'waitlist'},
};

export const CURRENCY_OPTIONS = [
  { label: '€ EUR', value: 'EUR' },
  { label: '$ USD', value: 'USD' },
  { label: '£ GBP', value: 'GBP' },
  { label: '¥ JPY', value: 'JPY' },
  { label: 'Fr CHF', value: 'CHF' },
  { label: '$ CAD', value: 'CAD' },
  { label: '$ AUD', value: 'AUD' },
  { label: '₩ KRW', value: 'KRW' },
  { label: '฿ THB', value: 'THB' },
  { label: 'د.إ AED', value: 'AED' },
];

/**
 * Hébergement/Transport exclus des choix proposés à la création/édition
 * (désormais couverts par les réservations transverses — hôtel/vol/location,
 * voir Reservation.md) : l'enum et `ACTIVITY_TYPE_META` gardent ces valeurs
 * intactes pour ne pas casser les activités déjà existantes de ce type.
 */
const HIDDEN_ACTIVITY_TYPES: ActivityType[] = [ActivityType.HEBERGEMENT, ActivityType.TRANSPORT];

export const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPE_META)
  .filter(([value]) => !HIDDEN_ACTIVITY_TYPES.includes(value as ActivityType))
  .map(([value, { label }]) => ({ label, value: value as ActivityType }));

export const BOOKING_STATUS_OPTIONS = Object.entries(BOOKING_STATUS_META).map(
  ([value, { label }]) => ({ label, value: value as BookingStatus })
);
