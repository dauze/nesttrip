import { inject, Injectable } from '@angular/core';
import { updateDoc, doc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';

interface ReservationOrderUpdate {
  key: string;
  tripId: string;
  order: string[];
}

/** Persiste l'ordre manuel (drag-and-drop) des réservations — même pattern que `NotesPersistenceService`. */
@Injectable({ providedIn: 'root' })
export class ReservationOrderPersistenceService extends DebounceWriter<string, ReservationOrderUpdate> {
  private readonly db = inject(FirebaseService).db;
  constructor() {
    super();
  }

  queueUpdate(tripId: string, order: string[]) {
    this.queue(tripId, { key: tripId, tripId, order });
  }

  protected override write(updates: ReservationOrderUpdate[]) {
    return Promise.all(
      updates.map((u) => updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
        reservationOrder: u.order,
      }))
    );
  }
}
