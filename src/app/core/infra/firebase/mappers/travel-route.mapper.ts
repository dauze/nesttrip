import { WalkingRoute } from '@app/core/models/travel-route.dto';
import { TravelRouteFirebase } from '../models/travel-route.dto';

export function travelRouteFromFb(data: TravelRouteFirebase): WalkingRoute {
  return {
    distanceMeters: data.distanceMeters,
    durationSeconds: data.durationSeconds,
  };
}
