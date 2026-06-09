import { Injectable, inject } from '@angular/core';
import { doc, updateDoc, DocumentReference } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';

@Injectable({ providedIn: 'root' })
export class TravelFirestoreService {
  private readonly db = inject(FirebaseService).db;

  tripRef(tripId: number): DocumentReference {
    return doc(this.db, 'trips', tripId.toString());
  }

  updateActivities(tripId: number, dayId: Date, activities: any[]) {
    return updateDoc(this.tripRef(tripId), {
      [`days.${dayId.getTime()}.activities`]: activities,
    });
  }

  updateInfo(tripId: number, items: any[]) {
    return updateDoc(this.tripRef(tripId), {
      'info.items': items,
    });
  }
}
