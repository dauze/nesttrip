import { inject, Injectable } from '@angular/core';
import { Item } from '@app/features/travel/infos/info.models';
import { TravelFirestoreService } from '@core/infra/firebase/services/travel.firebase.service';
import { BasePersistenceService } from './base.persistence.service';

type InfoUpdate = {
  key: number;
  tripId: number;
  items: Item[];
};

@Injectable({ providedIn: 'root' })
export class InfoPersistenceService extends BasePersistenceService<number, InfoUpdate> {
  private readonly firestore = inject(TravelFirestoreService);

  constructor() {
    super();
  }

  queueUpdate(tripId: number, items: Item[]) {
    this.queue(tripId, { key: tripId, tripId, items });
  }

  protected override write(updates: InfoUpdate[]) {
    return Promise.all(
      updates.map((u) => this.firestore.updateInfo(u.tripId, u.items))
    );
  }
}