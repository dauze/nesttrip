import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { FlightStatus } from '@core/models/reservation.dto';

interface FlightStatusApiResponse {
  state: FlightStatus['state'];
  delayMinutes?: number;
  actualDepartureTime?: string;
  actualArrivalTime?: string;
}

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
