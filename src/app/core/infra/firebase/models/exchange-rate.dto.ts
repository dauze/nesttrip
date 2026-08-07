import { Timestamp } from 'firebase/firestore';

/**
 * Doc `exchangeRates/{YYYY-MM-DD}` — écrit uniquement côté serveur (Cloud
 * Functions, voir `get-exchange-rates.handler.ts` et firestore.rules), lu ici
 * en cache quasi gratuit avant d'appeler notre backend. Un seul doc par jour
 * (clé = date UTC) sert de TTL implicite : pas de doc pour aujourd'hui = pas
 * encore calculé, le backend le calcule et l'écrit à la première demande.
 * `base` vaut toujours 'EUR' (devise native de l'API Frankfurter), `rates`
 * donne le nombre d'unités de chaque devise pour 1 EUR.
 */
export interface ExchangeRateFirebase {
  base: string;
  rates: Record<string, number>;
  fetchedAt: Timestamp;
}
