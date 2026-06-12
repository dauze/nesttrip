import { inject, Injectable } from '@angular/core';
import { BasePersistenceService } from './base.persistence.service';
import { Item } from '@app/features/trips/trip-detail/infos/info.models';
import { updateDoc, doc } from 'firebase/firestore';
import { FirebaseService } from '../firebase.service';

type InfoUpdate = {
  key: string;
  tripId: string;
  items: Item[];
};

@Injectable({ providedIn: 'root' })
export class InfoPersistenceService extends BasePersistenceService<string, InfoUpdate> {
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