import { inject, Injectable } from '@angular/core';
import {  deleteField, doc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { Day } from '@app/features/trips/trip.model';

@Injectable({ providedIn: 'root' })
export class DayPersistenceService {
  private readonly db = inject(FirebaseService).db;

  removeDay(tripId: string, dayId: Date): Promise<void> {
    return updateDoc(
      doc(this.db, 'trips', tripId),
        {
          [`days.${dayId.getTime()}`]: deleteField(),
        }
      );
    }

  addDay(tripId: string, day: Day): Promise<void> {
  return updateDoc(
    doc(this.db, 'trips', tripId),
    {
      [`days.${day.id.toISOString()}`]: {
        activities: []
      }
    }
  );
}
}