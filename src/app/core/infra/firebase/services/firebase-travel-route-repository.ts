import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TravelRouteRepository } from './travel-route-repository';
import { TravelRouteDataSource } from './travel-route-data-source';
import { WalkingRoute } from '@app/core/models/travel-route.dto';

@Injectable({ providedIn: 'root' })
export class FirebaseTravelRouteRepository extends TravelRouteRepository {
  private readonly dataSource = inject(TravelRouteDataSource);

  getCachedRoute$(routeId: string): Observable<WalkingRoute | null> {
    return this.dataSource.getCachedRoute$(routeId);
  }
}
