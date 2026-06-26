import { inject, Injectable } from '@angular/core';
import { Item } from '@app/features/trips/trip-detail/trip-day-swiper/infos/info.models';
import { updateDoc, doc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';

interface InfoUpdate {
  key: string;
  tripId: string;
  items: Item[];
}

@Injectable({ providedIn: 'root' })
export class InfosPersistenceService extends DebounceWriter<string, InfoUpdate> {
  private readonly db = inject(FirebaseService).db;
  constructor() {
    super();
  }

  queueUpdate(tripId: string, items: Item[]) {
    this.queue(tripId, { key: tripId, tripId, items });
  }

  protected override write(updates: InfoUpdate[]) {
    return Promise.all(
      updates.map((u) => updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
            'info.items': u.items,
          })
    ));
  }
}