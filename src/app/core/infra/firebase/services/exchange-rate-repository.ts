import { Observable } from 'rxjs';
import { ExchangeRates } from '@app/core/models/exchange-rate.dto';

export abstract class ExchangeRateRepository {
  /** `null` = taux du jour pas encore calculé côté serveur (cache miss), pas une erreur. */
  abstract getCachedRates$(dateKey: string): Observable<ExchangeRates | null>;
}
