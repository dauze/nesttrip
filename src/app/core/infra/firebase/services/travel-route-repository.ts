import { Observable } from 'rxjs';
import { WalkingRoute } from '@app/core/models/travel-route.dto';

export abstract class TravelRouteRepository {
  /** `null` = paire+mode pas encore calculée (cache miss), pas une erreur. */
  abstract getCachedRoute$(routeId: string): Observable<WalkingRoute | null>;
}
