import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

export interface ExchangeRatesResult {
  base: string;
  rates: Record<string, number>;
}

interface FrankfurterResponse {
  base: string;
  rates: Record<string, number>;
}

/** Clé du doc `exchangeRates/{dateKey}` — date UTC du jour, sert de TTL implicite (voir le doc de `ExchangeRateFirebase` côté client). */
function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getExchangeRatesHandler(req: Request, res: Response) {
  const dateKey = todayDateKey();
  const rateRef = admin.firestore().collection('exchangeRates').doc(dateKey);

  try {
    // Cache Firestore global (1 doc par jour, voir ROADMAP.md "Devise") :
    // évite un appel à Frankfurter pour un jour déjà calculé, par n'importe
    // quel utilisateur/trip — l'essentiel des requêtes tombent en cache-hit.
    const cached = await rateRef.get();
    if (cached.exists) {
      const data = cached.data() as ExchangeRatesResult;
      res.json({ base: data.base, rates: data.rates });
      return;
    }

    // Frankfurter (https://api.frankfurter.dev) : gratuit, sans clé API, sans
    // quota, données ECB mises à jour chaque jour ouvré — voir ROADMAP.md.
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR');

    if (!response.ok) {
      console.error('Frankfurter API error:', await response.text());
      res.status(response.status).json({ error: 'Erreur API taux de change' });
      return;
    }

    const data = (await response.json()) as FrankfurterResponse;
    const result: ExchangeRatesResult = { base: data.base, rates: data.rates };

    await rateRef.set({ ...result, fetchedAt: admin.firestore.FieldValue.serverTimestamp() });

    res.json(result);
  } catch (err) {
    console.error('getExchangeRates network error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
