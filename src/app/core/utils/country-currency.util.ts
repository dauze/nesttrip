import { CURRENCY_OPTIONS } from '@app/shared/components/activity-card/activity.constants';

/**
 * ISO 3166-1 alpha-2 -> devise ISO 4217, restreint aux pays des devises
 * supportées par l'app (`CURRENCY_OPTIONS`). Zone euro élargie (une seule
 * devise couvre ~20 pays) — pas besoin d'exhaustivité mondiale, un pays
 * absent retombe simplement sur la devise par défaut du voyage (voir
 * `suggestedCurrencyForCountry`).
 */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR',
  FI: 'EUR', GR: 'EUR', LU: 'EUR', SI: 'EUR', SK: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR',
  US: 'USD',
  GB: 'GBP',
  JP: 'JPY',
  CH: 'CHF',
  CA: 'CAD',
  AU: 'AUD',
  KR: 'KRW',
  TH: 'THB',
  AE: 'AED',
};

const SUPPORTED_CURRENCIES = new Set(CURRENCY_OPTIONS.map((o) => o.value));

/**
 * Devise suggérée pour préremplir la pop-up de saisie d'une carte
 * (activité/logement/transport), déduite du pays du lieu Google sélectionné
 * sur CETTE carte (`countryCode`, voir `PlaceSummary`/`PoolActivity`) —
 * jamais un pivot de calcul (voir src/specs/devise.md 3.1). `undefined` si le
 * pays est inconnu ou sa devise non supportée par l'app, à charge de
 * l'appelant de retomber sur la devise par défaut du voyage.
 */
export function suggestedCurrencyForCountry(countryCode: string | undefined): string | undefined {
  if (!countryCode) return undefined;
  const currency = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()];
  return currency && SUPPORTED_CURRENCIES.has(currency) ? currency : undefined;
}
