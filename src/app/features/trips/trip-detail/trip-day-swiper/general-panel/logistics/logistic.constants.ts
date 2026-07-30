import { LogisticType } from '@core/models/logistic.dto';

export interface LogisticTypeMeta {
  label: string;
  icon: string;
  /** Libellés contextuels des champs de dates communs (voir LogisticDetailsComponent). */
  startLabel: string;
  endLabel: string;
}

export const LOGISTIC_TYPE_META: Record<LogisticType, LogisticTypeMeta> = {
  logement: { label: 'Logement', icon: 'pi pi-building', startLabel: 'Check-in', endLabel: 'Check-out' },
  flight: { label: 'Vol', icon: 'pi pi-send', startLabel: 'Départ', endLabel: 'Arrivée' },
  carRental: { label: 'Location de voiture', icon: 'pi pi-car', startLabel: 'Prise en charge', endLabel: 'Restitution' },
  other: { label: 'Autre', icon: 'pi pi-map-marker', startLabel: 'Début', endLabel: 'Fin' },
};

export const LOGISTIC_TYPE_OPTIONS = Object.entries(LOGISTIC_TYPE_META).map(
  ([value, { label }]) => ({ label, value: value as LogisticType }),
);

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
