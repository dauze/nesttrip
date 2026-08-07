/** Table de taux de change du jour, base EUR (voir currency-conversion.util.ts pour la conversion entre 2 devises quelconques). */
export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
}
