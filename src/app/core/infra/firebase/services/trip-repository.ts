import { Observable } from 'rxjs';
import { Trip, TripSummary } from '@app/features/trips/trip.model';

export abstract class TripRepository {
  abstract getTrips$(): Observable<TripSummary[]>;
  abstract getTrip$(id: string): Observable<Trip>;
}