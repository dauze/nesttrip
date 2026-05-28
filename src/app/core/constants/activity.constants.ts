import { ActivityType } from '../enums/activites-type.enum';
import { BookingStatus } from '../enums/booking.status';

export interface ActivityTypeMeta {
  label: string;
  icon: string;
}

export interface BookingStatusMeta {
  label: string;
  className: string;
}

export const ACTIVITY_TYPE_META: Record<ActivityType, ActivityTypeMeta> = {
  [ActivityType.REPAS]: {label: 'Repas', icon: 'pi pi-star', },
  [ActivityType.TRANSPORT]: {label: 'Transport', icon: 'pi pi-car', },
  [ActivityType.HEBERGEMENT]: {label: 'Hébergement', icon: 'pi pi-home', },
  [ActivityType.VISITE]: {label: 'Visite', icon: 'pi pi-map-marker', },
  [ActivityType.ACTIVITE]: {label: 'Activité', icon: 'pi pi-bolt', },
  [ActivityType.SHOPPING]: {label: 'Shopping', icon: 'pi pi-shopping-bag', },
  [ActivityType.DETENTE]: {label: 'Détente', icon: 'pi pi-heart', },
  [ActivityType.EVENEMENT]: {label: 'Événement', icon: 'pi pi-calendar', },
  [ActivityType.NATURE]: {label: 'Nature', icon: 'pi pi-sun', },
  [ActivityType.SOINS]: {label: 'Soins', icon: 'pi pi-plus-circle', },
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

export const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPE_META).map(
  ([value, { label }]) => ({ label, value: value as ActivityType })
);

export const BOOKING_STATUS_OPTIONS = Object.entries(BOOKING_STATUS_META).map(
  ([value, { label }]) => ({ label, value: value as BookingStatus })
);
