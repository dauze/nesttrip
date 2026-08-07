import { CURRENCY_OPTIONS } from '@app/shared/components/activity-card/activity.constants';

/**
 * Locale complète (langue+région, ex. "fr-FR"/"fr-CA") -> devise supportée
 * par l'app. Mappé sur la locale COMPLÈTE (voir src/specs/devise.md 3.2) :
 * le préfixe de langue seul confondrait à tort `fr-FR` et `fr-CA`, qui
 * n'ont pas la même devise.
 */
const LOCALE_TO_CURRENCY: Record<string, string> = {
  'fr-FR': 'EUR', 'fr-BE': 'EUR', 'fr-LU': 'EUR', 'fr-CH': 'CHF', 'fr-CA': 'CAD',
  'de-DE': 'EUR', 'de-AT': 'EUR', 'de-LU': 'EUR', 'de-CH': 'CHF',
  'es-ES': 'EUR', 'it-IT': 'EUR', 'pt-PT': 'EUR', 'nl-NL': 'EUR', 'nl-BE': 'EUR',
  'en-US': 'USD', 'en-GB': 'GBP', 'en-CA': 'CAD', 'en-AU': 'AUD', 'en-IE': 'EUR',
  'ja-JP': 'JPY', 'ko-KR': 'KRW', 'th-TH': 'THB', 'ar-AE': 'AED', 'en-AE': 'AED',
};

const SUPPORTED_CURRENCIES = new Set(CURRENCY_OPTIONS.map((o) => o.value));

/**
 * Devise déduite de la locale navigateur (`navigator.language`, langue+région)
 * — fallback 'EUR' si la locale est inconnue ou pointe vers une devise non
 * supportée par l'app. Ne représente JAMAIS un choix explicite de
 * l'utilisateur (voir `UserProfileService.defaultCurrency`, qui l'utilise
 * uniquement tant qu'aucun choix explicite n'a été fait).
 */
export function detectCurrencyFromLocale(locale: string | undefined): string {
  if (!locale) return 'EUR';
  const currency = LOCALE_TO_CURRENCY[locale];
  return currency && SUPPORTED_CURRENCIES.has(currency) ? currency : 'EUR';
}
