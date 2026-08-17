import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { FlightStatus } from '@core/models/logistic.dto';
import { formatDateParam } from '@core/utils/date-param.util';

interface FlightStatusApiResponse {
  state: FlightStatus['state'];
  delayMinutes?: number;
  actualDepartureTime?: string;
  actualArrivalTime?: string;
}

/** Appelle le proxy maison (jamais AeroDataBox directement côté client, clé API serveur uniquement). */
@Injectable({ providedIn: 'root' })
export class FlightStatusApiService {
  private readonly http = inject(HttpClient);

  getStatus$(flightNumber: string, departureDate: Date): Observable<FlightStatus> {
    const date = formatDateParam(departureDate);
    return this.http
      .get<FlightStatusApiResponse>(`${environment.apiUrl}/vols/${encodeURIComponent(flightNumber)}/status`, { params: { date } })
      .pipe(
        map((r) => ({
          state: r.state,
          delayMinutes: r.delayMinutes,
          actualDepartureTime: r.actualDepartureTime ? new Date(Number(r.actualDepartureTime)) : undefined,
          actualArrivalTime: r.actualArrivalTime ? new Date(Number(r.actualArrivalTime)) : undefined,
        })),
      );
  }
}
