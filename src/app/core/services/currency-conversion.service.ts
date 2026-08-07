import { Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { environment } from '@environments/environment';
import { LoadingState } from '../models/place.dto';
import { ExchangeRates } from '../models/exchange-rate.dto';
import { ExchangeRateRepository } from '@app/core/infra/firebase/services/exchange-rate-repository';
import { convertWithRates } from './currency-conversion.util';

export interface ConvertedAmount {
  amount: number;
  /** `true` si le taux utilisé n'est pas celui du jour (dernier taux connu retombé en cache après un échec réseau/backend, voir `getRates$`). */
  approximate: boolean;
}

interface RatesEntry {
  table: ExchangeRates;
  approximate: boolean;
}

export interface RatesState {
  rates: Record<string, number>;
  approximate: boolean;
}

/**
 * Conversion de devises via le backend maison (voir
 * `functions/src/taux-change/get-exchange-rates.handler.ts`, API Frankfurter
 * — gratuite, sans clé, sans quota). `providedIn: 'root'` (pas scopé à
 * `/trips`) : le cache mémoire doit survivre à un changement de trip dans la
 * même session.
 *
 * Résolution en cascade, du moins cher au plus cher : 1) cache mémoire de ce
 * service (session courante, par date), 2) `ExchangeRateRepository` (cache
 * Firestore global du jour, quasi gratuit, partagé entre tous les
 * trips/utilisateurs), 3) le backend (qui a lui-même son propre cache
 * Firestore avant d'appeler Frankfurter — voir le handler). Si les 3 échouent
 * (offline) mais qu'un taux d'un jour précédent a déjà été résolu pendant
 * cette session, on le réutilise avec `approximate: true` plutôt que d'échouer
 * (voir spec `src/specs/devise.md` section 3.3, "taux approximatif").
 */
@Injectable({ providedIn: 'root' })
export class CurrencyConversionService {
  private readonly http = inject(HttpClient);
  private readonly exchangeRateRepository = inject(ExchangeRateRepository);

  private readonly ratesCache = new Map<string, Observable<LoadingState<RatesEntry>>>();
  private lastKnownRates: ExchangeRates | null = null;

  /**
   * Signal du dernier état de taux résolu — permet des agrégations
   * SYNCHRONES (sommer N montants de devises différentes, voir
   * `TripSummaryComponent.totalConverted`) sans empiler N appels
   * asynchrones à `convert$` : une fois les taux du jour chargés, croiser
   * via `convertWithRates` (fonction pure) est un calcul immédiat.
   */
  readonly ratesState: Signal<LoadingState<RatesState>> = toSignal(
    this.getRates$().pipe(
      map((state): LoadingState<RatesState> =>
        state.status === 'success'
          ? { status: 'success', data: { rates: state.data.table.rates, approximate: state.data.approximate } }
          : state,
      ),
    ),
    { initialValue: { status: 'loading' } as LoadingState<RatesState> },
  );

  private getRates$(): Observable<LoadingState<RatesEntry>> {
    const dateKey = new Date().toISOString().slice(0, 10);
    let entry = this.ratesCache.get(dateKey);
    if (!entry) {
      entry = this.exchangeRateRepository.getCachedRates$(dateKey).pipe(
        // Cache Firestore best-effort : une erreur ici (permission-denied si
        // les règles ne sont pas encore déployées, ou tout autre pépin réseau)
        // dégrade vers un cache-miss silencieux, PAS un échec du segment — le
        // backend reste la source de vérité.
        catchError(() => of(null)),
        switchMap((cached) =>
          cached ? of(cached) : this.http.get<ExchangeRates>(`${environment.apiUrl}/taux-change`),
        ),
        tap((table) => (this.lastKnownRates = table)),
        map((table): LoadingState<RatesEntry> => ({ status: 'success', data: { table, approximate: false } })),
        startWith({ status: 'loading' } as LoadingState<RatesEntry>),
        // Le doc du jour est inatteignable (offline, backend down...) : on
        // retombe sur le dernier taux résolu avec succès dans cette session
        // plutôt que d'échouer (voir spec section 3.3, "taux approximatif").
        catchError(() =>
          this.lastKnownRates
            ? of({ status: 'success', data: { table: this.lastKnownRates, approximate: true } } as LoadingState<RatesEntry>)
            : of({ status: 'error' } as LoadingState<RatesEntry>),
        ),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.ratesCache.set(dateKey, entry);
    }
    return entry;
  }

  /** Convertit `amount` de `from` vers `to`. `approximate: true` si le taux utilisé n'est pas celui du jour (voir doc de classe). */
  convert$(amount: number, from: string, to: string): Observable<LoadingState<ConvertedAmount>> {
    return this.getRates$().pipe(
      map((state): LoadingState<ConvertedAmount> => {
        if (state.status !== 'success') return state;
        const converted = convertWithRates(amount, from, to, state.data.table.rates);
        if (converted === null) return { status: 'error' };
        return { status: 'success', data: { amount: converted, approximate: state.data.approximate } };
      }),
    );
  }
}
