import { Observable } from 'rxjs';
import { Trip } from '@app/features/trips/trip.model';

export abstract class TripRepository {
  abstract getTrips$(): Observable<Pick<Trip, 'id' | 'title'>[]>;
  abstract getTrip$(id: string): Observable<Trip>;
}