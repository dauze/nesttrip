import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { environment } from '@environments/environment';
import { LoadingState } from '../models/place.dto';
import { WalkingRoute } from '../models/travel-route.dto';
import { TravelRouteRepository } from '@app/core/infra/firebase/services/travel-route-repository';
import { buildTravelRouteId, TravelMode } from '../utils/travel-route-id.util';

/**
 * Distance/temps entre 2 `placeId` pour un mode donné (marche/vélo/voiture,
 * voir `selectTravelMode`), via le backend maison (voir
 * `functions/src/trajets/get-trajet.handler.ts`, Google Routes API — un
 * appel payant SÉPARÉ par mode, voir ROADMAP.md). `providedIn: 'root'` (pas
 * scopé à `/trips`) : le cache mémoire doit survivre à un changement de trip
 * dans la même session, pas seulement pendant qu'on reste dans un trip donné.
 *
 * Résolution en cascade, du moins cher au plus cher : 1) cache mémoire de ce
 * service (session courante), 2) `TravelRouteRepository` (cache Firestore
 * global, quasi gratuit, partagé entre tous les trips/utilisateurs), 3) le
 * backend (qui a lui-même son propre cache Firestore avant d'appeler
 * Google — voir le handler). Résultat toujours re-stocké en 1) ensuite.
 */
@Injectable({ providedIn: 'root' })
export class TravelDistanceService {
  private readonly http = inject(HttpClient);
  private readonly travelRouteRepository = inject(TravelRouteRepository);

  private readonly routeCache = new Map<string, Observable<LoadingState<WalkingRoute>>>();

  getRoute$(originPlaceId: string, destinationPlaceId: string, mode: TravelMode): Observable<LoadingState<WalkingRoute>> {
    const key = `${originPlaceId}:${destinationPlaceId}:${mode}`;
    let entry = this.routeCache.get(key);
    if (!entry) {
      const routeId = buildTravelRouteId(originPlaceId, destinationPlaceId, mode);
      entry = this.travelRouteRepository.getCachedRoute$(routeId).pipe(
        // Le cache Firestore est un raccourci best-effort : une erreur ici (ex.
        // permission-denied si `firestore.rules` n'est pas encore déployé, ou
        // tout autre pépin réseau) doit dégrader vers un cache-miss silencieux,
        // PAS faire échouer tout le segment — le backend reste la source de
        // vérité et a lui-même son propre cache Firestore avant Google.
        catchError(() => of(null)),
        switchMap((cached) =>
          cached
            ? of(cached)
            : this.http.get<WalkingRoute>(`${environment.apiUrl}/trajets`, {
                params: { origin: originPlaceId, destination: destinationPlaceId, mode },
              }),
        ),
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
