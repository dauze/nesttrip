import { LogisticType } from '@core/models/logistic.dto';

export interface LogisticTypeMeta {
  label: string;
  icon: string;
  /** Libellés contextuels des champs de dates communs (voir LogisticDetailsComponent). */
  startLabel: string;
  endLabel: string;
  /** Jeton CSS (`--nt-logistic-*`, voir tokens.scss) portant la couleur d'identité du type — un seul point de vérité, pas de `[ngSwitch]` de couleurs dispersé dans chaque composant. */
  colorVar: string;
}

export const LOGISTIC_TYPE_META: Record<LogisticType, LogisticTypeMeta> = {
  logement: { label: 'Logement', icon: 'pi pi-building', startLabel: 'Check-in', endLabel: 'Check-out', colorVar: '--nt-logistic-logement' },
  flight: { label: 'Vol', icon: 'pi pi-send', startLabel: 'Départ', endLabel: 'Arrivée', colorVar: '--nt-logistic-flight' },
  carRental: { label: 'Location de voiture', icon: 'pi pi-car', startLabel: 'Prise en charge', endLabel: 'Restitution', colorVar: '--nt-logistic-carrental' },
  train: { label: 'Train', icon: 'pi pi-directions', startLabel: 'Départ', endLabel: 'Arrivée', colorVar: '--nt-logistic-train' },
  other: { label: 'Autre', icon: 'pi pi-map-marker', startLabel: 'Début', endLabel: 'Fin', colorVar: '--nt-logistic-other' },
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
