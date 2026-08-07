import { ExchangeRates } from '@app/core/models/exchange-rate.dto';
import { ExchangeRateFirebase } from '../models/exchange-rate.dto';

export function exchangeRatesFromFb(data: ExchangeRateFirebase): ExchangeRates {
  return {
    base: data.base,
    rates: data.rates,
  };
}
