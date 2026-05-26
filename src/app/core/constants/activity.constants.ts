import { ActivityType } from '../enums/activites-type.enum';
import { BookingStatus } from '../enums/booking.status';

export interface ActivityTypeMeta {
  label: string;
  icon: string;
  color: string;
}

export interface BookingStatusMeta {
  label: string;
  severity: 'success' | 'warn' | 'danger' | 'info' | 'secondary';
}

export const ACTIVITY_TYPE_META: Record<ActivityType, ActivityTypeMeta> = {
  [ActivityType.REPAS]:        { label: '🍽️ Repas',        icon: 'pi pi-star',          color: '#f97316' },
  [ActivityType.TRANSPORT]:    { label: '🚗 Transport',     icon: 'pi pi-car',            color: '#6366f1' },
  [ActivityType.HEBERGEMENT]:  { label: '🏠 Hébergement',   icon: 'pi pi-home',           color: '#14b8a6' },
  [ActivityType.VISITE]:       { label: '📍 Visite',        icon: 'pi pi-map-marker',     color: '#8b5cf6' },
  [ActivityType.ACTIVITE]:     { label: '⚡ Activité',      icon: 'pi pi-bolt',           color: '#ec4899' },
  [ActivityType.SHOPPING]:     { label: '🛍️ Shopping',      icon: 'pi pi-shopping-bag',   color: '#f59e0b' },
  [ActivityType.DETENTE]:      { label: '💆 Détente',       icon: 'pi pi-heart',          color: '#10b981' },
  [ActivityType.EVENEMENT]:    { label: '🎉 Événement',     icon: 'pi pi-calendar',       color: '#3b82f6' },
  [ActivityType.NATURE]:       { label: '🌿 Nature',        icon: 'pi pi-sun',            color: '#22c55e' },
  [ActivityType.SOINS]:        { label: '💊 Soins',         icon: 'pi pi-plus-circle',    color: '#06b6d4' },
};

export const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  [BookingStatus.TO_BOOK]:    { label: '📋 À réserver',        severity: 'warn'      },
  [BookingStatus.BOOKED]:     { label: '✅ Réservé',            severity: 'success'   },
  [BookingStatus.NOT_NEEDED]: { label: '— Sans réservation',   severity: 'secondary' },
  [BookingStatus.WAITLIST]:   { label: '⏳ Liste d\'attente',   severity: 'info'      },
  [BookingStatus.CANCELLED]:  { label: '❌ Annulé',             severity: 'danger'    },
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