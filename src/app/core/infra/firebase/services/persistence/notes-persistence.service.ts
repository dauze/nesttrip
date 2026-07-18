import { inject, Injectable } from '@angular/core';
import { updateDoc, doc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';
import { Item } from '@app/features/trips/trip-detail/trip-day-swiper/general-panel/notes/notes.model';

interface NotesUpdate {
  key: string;
  tripId: string;
  items: Item[];
}

@Injectable({ providedIn: 'root' })
export class NotesPersistenceService extends DebounceWriter<string, NotesUpdate> {
  private readonly db = inject(FirebaseService).db;
  constructor() {
    super();
  }

  queueUpdate(tripId: string, items: Item[]) {
    this.queue(tripId, { key: tripId, tripId, items });
  }

  protected override write(updates: NotesUpdate[]) {
    return Promise.all(
      updates.map((u) => updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
            'notes.items': u.items,
          })
    ));
  }
}