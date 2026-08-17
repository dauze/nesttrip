import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { formatDateParam } from '@core/utils/date-param.util';

export interface FlightLookupResult {
  airline?: string;
  departureAirportName?: string;
  arrivalAirportName?: string;
  scheduledDepartureTime?: Date;
  scheduledArrivalTime?: Date;
}

interface FlightLookupApiResponse {
  airline?: string;
  departureAirportName?: string;
  arrivalAirportName?: string;
  scheduledDepartureTime?: string;
  scheduledArrivalTime?: string;
}

/**
 * Lookup "statique" d'un vol (compagnie, aéroports, horaires prévus) —
 * utilisé uniquement à la création guidée d'une réservation de type vol (voir
 * ROADMAP.md). Distinct de `FlightStatusApiService` (suivi temps réel) : même
 * proxy AeroDataBox côté serveur, endpoint différent.
 */
@Injectable({ providedIn: 'root' })
export class FlightLookupApiService {
  private readonly http = inject(HttpClient);

  getLookup$(flightNumber: string, departureDate: Date): Observable<FlightLookupResult> {
    const date = formatDateParam(departureDate);
    return this.http
      .get<FlightLookupApiResponse>(`${environment.apiUrl}/vols/${encodeURIComponent(flightNumber)}/lookup`, { params: { date } })
      .pipe(
        map((r) => ({
          airline: r.airline,
          departureAirportName: r.departureAirportName,
          arrivalAirportName: r.arrivalAirportName,
          scheduledDepartureTime: r.scheduledDepartureTime ? new Date(Number(r.scheduledDepartureTime)) : undefined,
          scheduledArrivalTime: r.scheduledArrivalTime ? new Date(Number(r.scheduledArrivalTime)) : undefined,
        })),
      );
  }
}
