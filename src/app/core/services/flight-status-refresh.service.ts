import { inject, Injectable } from '@angular/core';
import { EMPTY, Observable, tap } from 'rxjs';
import { FlightReservation, FlightStatus } from '@core/models/reservation.dto';
import { FlightStatusApiService } from './flight-status-api.service';
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
export function getRefreshPhase(flight: FlightReservation, now: Date): RefreshPhase {
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
 * partagé, voir `ReservationPersistenceService.updateFlightStatus`).
 */
@Injectable({ providedIn: 'root' })
export class FlightStatusRefreshService {
  private readonly api = inject(FlightStatusApiService);
  private readonly tripFacade = inject(TripFacade);

  refreshIfStale(tripId: string, reservation: FlightReservation, now = new Date()): void {
    if (!reservation.flightNumber) return;

    const phase = getRefreshPhase(reservation, now);
    const intervalMs = REFRESH_INTERVAL_MS[phase];
    if (intervalMs === null) return;

    const lastFetch = reservation.statusFetchedAt?.getTime() ?? 0;
    if (now.getTime() - lastFetch < intervalMs) return;

    this.forceRefresh(tripId, reservation).subscribe({
      error: (err) => console.error('[FlightStatusRefreshService] Erreur rafraîchissement auto :', err),
    });
  }

  /** Bouton de rafraîchissement manuel : ignore la fraîcheur, toujours un vrai appel réseau. No-op tant que le n° de vol n'est pas encore renseigné. */
  forceRefresh(tripId: string, reservation: FlightReservation): Observable<FlightStatus> {
    if (!reservation.flightNumber) return EMPTY;

    return this.api.getStatus$(reservation.flightNumber, reservation.startDateTime).pipe(
      tap((status) => this.tripFacade.updateFlightStatus(tripId, reservation, status, new Date())),
    );
  }
}
