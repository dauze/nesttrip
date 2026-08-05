export interface FlightLookupResponse {
  airline?: string;
  departureAirportName?: string;
  arrivalAirportName?: string;
  /** Timestamps en ms (string), même convention que FlightStatusResponse. */
  scheduledDepartureTime?: string;
  scheduledArrivalTime?: string;
}
