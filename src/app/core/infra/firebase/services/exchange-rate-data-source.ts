import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { ExchangeRateFirebase } from '@app/core/infra/firebase/models/exchange-rate.dto';
import { exchangeRatesFromFb } from '@app/core/infra/firebase/mappers/exchange-rate.mapper';
import { ExchangeRates } from '@app/core/models/exchange-rate.dto';

@Injectable({ providedIn: 'root' })
export class ExchangeRateDataSource {
  private readonly db = inject(FirebaseService).db;

  /**
   * Lecture ponctuelle (`getDoc`), volontairement PAS `onSnapshot` (même
   * raison que `TravelRouteDataSource`) : `exchangeRates/{dateKey}` est
   * immuable une fois calculé côté serveur pour une date donnée (voir
   * `get-exchange-rates.handler.ts`) — rester abonné en temps réel à un doc
   * qui ne change jamais gaspillerait une souscription active pour rien.
   */
  getCachedRates$(dateKey: string): Observable<ExchangeRates | null> {
    return new Observable((observer) => {
      getDoc(doc(this.db, 'exchangeRates', dateKey))
        .then((snap) => {
          const data = snap.data();
          observer.next(data ? exchangeRatesFromFb(data as ExchangeRateFirebase) : null);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }
}
