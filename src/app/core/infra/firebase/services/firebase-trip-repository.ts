import { Injectable } from '@angular/core';
import { TripRepository } from './trip-repository';
import { TripDataSource } from './trip-data-source';
import { Observable } from 'rxjs';
import { Trip } from '@app/features/trips/trip.model';
import { inject } from '@angular/core';

@Injectable()
export class FirebaseTripRepository extends TripRepository {
  private readonly dataSource = inject(TripDataSource);

  getTrips$(): Observable<Pick<Trip, 'id' | 'title'>[]> {
    return this.dataSource.getTrips$();
  }

  getTrip$(id: string): Observable<Trip> {
    return this.dataSource.getTrip$(id);
  }
}