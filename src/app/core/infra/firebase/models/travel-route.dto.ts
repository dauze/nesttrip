import { Timestamp } from 'firebase/firestore';

/** Doc `travelRoutes/{routeId}` — écrit uniquement côté serveur (Cloud Functions, voir `get-trajet.handler.ts` et firestore.rules), lu ici en cache quasi gratuit avant d'appeler notre backend. */
export interface TravelRouteFirebase {
  distanceMeters: number;
  durationSeconds: number;
  computedAt: Timestamp;
}
