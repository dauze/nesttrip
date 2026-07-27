export type FlightState = 'scheduled' | 'onTime' | 'delayed' | 'cancelled' | 'landed';

export interface FlightStatusResponse {
  state: FlightState;
  delayMinutes?: number;
  /** Timestamps en ms (string), même convention que le reste du stockage Firestore côté client. */
  actualDepartureTime?: string;
  actualArrivalTime?: string;
}
