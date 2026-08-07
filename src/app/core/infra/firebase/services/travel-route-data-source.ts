import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { TravelRouteFirebase } from '@app/core/infra/firebase/models/travel-route.dto';
import { travelRouteFromFb } from '@app/core/infra/firebase/mappers/travel-route.mapper';
import { WalkingRoute } from '@app/core/models/travel-route.dto';

@Injectable({ providedIn: 'root' })
export class TravelRouteDataSource {
  private readonly db = inject(FirebaseService).db;

  /**
   * Lecture ponctuelle (`getDoc`), volontairement PAS `onSnapshot` malgré la
   * convention du reste du repo (voir CLAUDE.md "Lecture temps réel") : un
   * trajet `travelRoutes/{routeId}` est immuable une fois calculé côté
   * serveur (voir `get-trajet.handler.ts`), rester abonné en temps réel à un
   * doc qui ne change jamais gaspillerait une souscription active pour rien.
   */
  getCachedRoute$(routeId: string): Observable<WalkingRoute | null> {
    return new Observable((observer) => {
      getDoc(doc(this.db, 'travelRoutes', routeId))
        .then((snap) => {
          const data = snap.data();
          observer.next(data ? travelRouteFromFb(data as TravelRouteFirebase) : null);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }
}
