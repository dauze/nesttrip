import { inject, Injectable } from '@angular/core';
import { TravelFirestoreService } from '@core/infra/firebase/services/travel.firebase.service';
import { BasePersistenceService } from './base.persistence.service';
import { Item } from '@app/features/trips/trip-detail/infos/info.models';

type InfoUpdate = {
  key: string;
  tripId: string;
  items: Item[];
};

@Injectable({ providedIn: 'root' })
export class InfoPersistenceService extends BasePersistenceService<string, InfoUpdate> {
  private readonly firestore = inject(TravelFirestoreService);

  constructor() {
    super();
  }

  queueUpdate(tripId: string, items: Item[]) {
    this.queue(tripId, { key: tripId, tripId, items });
  }

  protected override write(updates: InfoUpdate[]) {
    return Promise.all(
      updates.map((u) => this.firestore.updateInfo(u.tripId, u.items))
    );
  }
}