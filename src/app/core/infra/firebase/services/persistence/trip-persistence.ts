import { inject, Injectable } from '@angular/core';
import { doc, setDoc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { Trip } from '@app/features/trips/trip.model';
import { tripToFb } from '@core/infra/firebase/mappers/trip.mapper';

@Injectable({ providedIn: 'root' })
export class TripPersistenceService {
  private readonly db = inject(FirebaseService).db;

  createTrip(trip: Trip): Promise<void> {
    return setDoc(doc(this.db, 'trips', trip.id), tripToFb(trip));
  }
}