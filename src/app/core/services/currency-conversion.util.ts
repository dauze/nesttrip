/**
 * AED (Dirham des Émirats arabes unis) n'est pas suivi par la BCE, donc absent
 * des taux Frankfurter (voir currency-conversion.service.ts). Peg fixe et
 * stable de longue date à l'USD (aucune fluctuation de marché) : servir de
 * fallback local plutôt que d'ajouter un 2e fournisseur pour une seule devise.
 */
const AED_PER_USD_PEG = 3.6725;

/** Nombre d'unités de `currency` pour 1 EUR, ou `null` si indéterminable avec les taux fournis. */
function resolveRateToEur(currency: string, rates: Record<string, number>): number | null {
  if (currency === 'EUR') return 1;
  if (rates[currency] !== undefined) return rates[currency];
  if (currency === 'AED' && rates['USD'] !== undefined) return rates['USD'] * AED_PER_USD_PEG;
  return null;
}

/**
 * Convertit `amount` de `from` vers `to` en croisant via EUR (base native de
 * `rates`, voir `ExchangeRates`). Retourne `null` si l'une des 2 devises n'a
 * pas de taux disponible (à charge de l'appelant de retomber sur un dernier
 * taux connu avec indicateur "approximatif", voir `CurrencyConversionService`).
 */
export function convertWithRates(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return amount;

  const fromRateToEur = resolveRateToEur(from, rates);
  const toRateToEur = resolveRateToEur(to, rates);
  if (fromRateToEur === null || toRateToEur === null) return null;

  const amountInEur = amount / fromRateToEur;
  return amountInEur * toRateToEur;
}
