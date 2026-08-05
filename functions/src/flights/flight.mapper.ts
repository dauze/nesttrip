import { FlightState, FlightStatusResponse } from './flight-status.dto';
import { FlightLookupResponse } from './flight-lookup.dto';

/**
 * Champ `status` retourné par l'endpoint AeroDataBox "FIDS by flight number"
 * (`GET /flights/number/{number}/{date}`) — voir doc AeroDataBox "Flight
 * status". Valeurs observées : 'Unknown' | 'Expected' | 'CheckIn' | 'Boarding'
 * | 'GateClosed' | 'Departed' | 'EnRoute' | 'Approaching' | 'Arrived' |
 * 'Delayed' | 'Canceled' | 'Diverted'. À VALIDER/ajuster une fois testé sur
 * de vrais vols (voir Reservation.md Phase 4, étape de validation) : ce
 * mapping est une première approximation raisonnable, pas une garantie
 * exhaustive de toutes les valeurs possibles de l'API.
 */
function mapState(status: unknown): FlightState {
  switch (status) {
    case 'Canceled':
    case 'Cancelled':
      return 'cancelled';
    case 'Arrived':
      return 'landed';
    case 'Delayed':
    case 'Diverted':
      return 'delayed';
    case 'Unknown':
    case undefined:
    case null:
      return 'scheduled';
    default:
      return 'onTime';
  }
}

interface AeroDataBoxTime {
  utc?: string;
  local?: string;
}

interface AeroDataBoxAirport {
  name?: string;
}

interface AeroDataBoxFlightLeg {
  scheduledTime?: AeroDataBoxTime;
  actualTime?: AeroDataBoxTime;
  revisedTime?: AeroDataBoxTime;
  airport?: AeroDataBoxAirport;
}

interface AeroDataBoxAirline {
  name?: string;
}

export interface AeroDataBoxFlight {
  status?: string;
  departure?: AeroDataBoxFlightLeg;
  arrival?: AeroDataBoxFlightLeg;
  airline?: AeroDataBoxAirline;
}

function toMillis(time: AeroDataBoxTime | undefined): number | undefined {
  const raw = time?.utc;
  if (!raw) return undefined;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

export function mapFlightStatus(flight: AeroDataBoxFlight): FlightStatusResponse {
  const scheduledDeparture = toMillis(flight.departure?.scheduledTime);
  const actualDeparture = toMillis(flight.departure?.actualTime) ?? toMillis(flight.departure?.revisedTime);
  const actualArrival = toMillis(flight.arrival?.actualTime) ?? toMillis(flight.arrival?.revisedTime);

  const delayMinutes = scheduledDeparture && actualDeparture && actualDeparture > scheduledDeparture
    ? Math.round((actualDeparture - scheduledDeparture) / 60_000)
    : undefined;

  return {
    state: mapState(flight.status),
    ...(delayMinutes ? { delayMinutes } : {}),
    ...(actualDeparture ? { actualDepartureTime: String(actualDeparture) } : {}),
    ...(actualArrival ? { actualArrivalTime: String(actualArrival) } : {}),
  };
}

/**
 * Détails "statiques" d'un vol (compagnie, aéroports, horaires prévus) —
 * utilisé uniquement à la CRÉATION guidée d'une réservation de type vol (voir
 * ROADMAP.md, cinématique "Vol"), pas pour le suivi de statut temps réel
 * (`mapFlightStatus`/`FlightStatusRefreshService`, endpoint séparé). Même
 * appel AeroDataBox, réponse différente extraite.
 */
export function mapFlightLookup(flight: AeroDataBoxFlight): FlightLookupResponse {
  const scheduledDeparture = toMillis(flight.departure?.scheduledTime);
  const scheduledArrival = toMillis(flight.arrival?.scheduledTime);

  return {
    ...(flight.airline?.name ? { airline: flight.airline.name } : {}),
    ...(flight.departure?.airport?.name ? { departureAirportName: flight.departure.airport.name } : {}),
    ...(flight.arrival?.airport?.name ? { arrivalAirportName: flight.arrival.airport.name } : {}),
    ...(scheduledDeparture ? { scheduledDepartureTime: String(scheduledDeparture) } : {}),
    ...(scheduledArrival ? { scheduledArrivalTime: String(scheduledArrival) } : {}),
  };
}
