import { inject, Injectable } from '@angular/core';
import { EMPTY, Observable, tap } from 'rxjs';
import { FlightLogistic, FlightStatus } from '@core/models/logistic.dto';
import { FlightStatusApiService } from '../api/flight-status-api.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';

export type RefreshPhase = 'manual' | 'auto-daily' | 'auto-live' | 'frozen';

function diffHours(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 3_600_000;
}

/**
 * Phase de rafraîchissement d'un vol selon sa proximité temporelle — voir
 * Reservation.md Phase 4. `frozen` : plus d'intérêt à rafraîchir 2h après
 * l'arrivée prévue. `auto-live`/`auto-daily` : polling automatique de plus
 * en plus fréquent à l'approche du vol. `manual` : trop loin dans le temps,
 * seul le bouton de rafraîchissement manuel fonctionne.
 */
export function getRefreshPhase(flight: FlightLogistic, now: Date): RefreshPhase {
  // Pas de date renseignée : rien à programmer, seul le rafraîchissement manuel a un sens (et est de toute façon bloqué par forceRefresh tant que la date n'est pas là).
  if (!flight.startDateTime || !flight.endDateTime) return 'manual';

  const hoursToDeparture = diffHours(flight.startDateTime, now);
  const hoursSinceArrival = diffHours(now, flight.endDateTime);

  if (hoursSinceArrival > 2) return 'frozen';
  if (hoursToDeparture <= 0) return 'auto-live';
  if (hoursToDeparture <= 24) return 'auto-daily';
  return 'manual';
}

export const REFRESH_INTERVAL_MS: Record<RefreshPhase, number | null> = {
  manual: null,
  'auto-daily': 30 * 60_000,
  'auto-live': 5 * 60_000,
  frozen: null,
};

/**
 * Un seul client déclenche le fetch réel à un instant donné : `refreshIfStale`
 * compare `statusFetchedAt` à l'intervalle de la phase courante et ne fait
 * rien si la donnée n'est pas encore périmée — les autres membres du trip
 * reçoivent la mise à jour gratuitement via `onSnapshot` (cache Firestore
 * partagé, voir `LogisticPersistenceService.updateFlightStatus`).
 */
// Pas `providedIn: 'root'` : dépend de `TripFacade`, lui-même scopé à
// `/trips` (voir TripsComponent.providers) — un root singleton qui dépend
// d'un service component-scopé n'a de garantie de fonctionner que si sa
// toute première construction a lieu depuis un contexte qui a ce provider
// dans sa chaîne d'ancêtres, ce qui n'est pas fiable (NG0201/NG0200 observés
// en pratique). Fourni explicitement au même niveau que TripFacade.
@Injectable()
export class FlightStatusRefreshService {
  private readonly api = inject(FlightStatusApiService);
  private readonly tripFacade = inject(TripFacade);

  refreshIfStale(tripId: string, logistic: FlightLogistic, now = new Date()): void {
    if (!logistic.flightNumber || !logistic.startDateTime) return;

    const phase = getRefreshPhase(logistic, now);
    const intervalMs = REFRESH_INTERVAL_MS[phase];
    if (intervalMs === null) return;

    const lastFetch = logistic.statusFetchedAt?.getTime() ?? 0;
    if (now.getTime() - lastFetch < intervalMs) return;

    this.forceRefresh(tripId, logistic).subscribe({
      error: (err) => console.error('[FlightStatusRefreshService] Erreur rafraîchissement auto :', err),
    });
  }

  /** Bouton de rafraîchissement manuel : ignore la fraîcheur, toujours un vrai appel réseau. No-op tant que le n° de vol n'est pas encore renseigné. */
  forceRefresh(tripId: string, logistic: FlightLogistic): Observable<FlightStatus> {
    if (!logistic.flightNumber || !logistic.startDateTime) return EMPTY;

    return this.api.getStatus$(logistic.flightNumber, logistic.startDateTime).pipe(
      tap((status) => this.tripFacade.updateFlightStatus(tripId, logistic, status, new Date())),
    );
  }
}
