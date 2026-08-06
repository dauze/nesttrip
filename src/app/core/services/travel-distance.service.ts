import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, startWith } from 'rxjs';
import { environment } from '@environments/environment';
import { LoadingState } from '../models/place.dto';
import { WalkingRoute } from '../models/travel-route.dto';

/**
 * Distance/temps à pied entre 2 `placeId`, via le backend maison (voir
 * `functions/src/trajets/get-trajet.handler.ts`, Google Routes API) — même
 * principe de cache mémoire par clé que `GooglePlaceService.getPlaceDetails$`
 * (une paire de placeId donnée ne change jamais de distance à pied, inutile
 * de rappeler l'API deux fois pour le même segment pendant la session).
 */
@Injectable()
export class TravelDistanceService {
  private readonly http = inject(HttpClient);

  private readonly routeCache = new Map<string, Observable<LoadingState<WalkingRoute>>>();

  getWalkingRoute$(originPlaceId: string, destinationPlaceId: string): Observable<LoadingState<WalkingRoute>> {
    const key = `${originPlaceId}:${destinationPlaceId}`;
    let entry = this.routeCache.get(key);
    if (!entry) {
      entry = this.http
        .get<WalkingRoute>(`${environment.apiUrl}/trajets`, {
          params: { origin: originPlaceId, destination: destinationPlaceId },
        })
        .pipe(
          map((data) => ({ status: 'success', data }) as LoadingState<WalkingRoute>),
          startWith({ status: 'loading' } as LoadingState<WalkingRoute>),
          catchError(() => of({ status: 'error' } as LoadingState<WalkingRoute>)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      this.routeCache.set(key, entry);
    }
    return entry;
  }
}
