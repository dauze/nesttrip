import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ExchangeRateRepository } from './exchange-rate-repository';
import { ExchangeRateDataSource } from './exchange-rate-data-source';
import { ExchangeRates } from '@app/core/models/exchange-rate.dto';

@Injectable({ providedIn: 'root' })
export class FirebaseExchangeRateRepository extends ExchangeRateRepository {
  private readonly dataSource = inject(ExchangeRateDataSource);

  getCachedRates$(dateKey: string): Observable<ExchangeRates | null> {
    return this.dataSource.getCachedRates$(dateKey);
  }
}
