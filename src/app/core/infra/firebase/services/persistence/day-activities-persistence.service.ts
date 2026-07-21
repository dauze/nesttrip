import { inject, Injectable } from '@angular/core';
import { updateDoc, doc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';

interface DayActivitiesUpdate {
  key: string;
  tripId: string;
  dayId: Date;
  activityIds: string[];
}

/**
 * Persiste la liste ordonnée des `activityIds` référencés par un jour
 * (`trips/{tripId}.days.{dayTime}.activityIds`). Ce sont des instance ids
 * (voir `DayActivityInstancePersistenceService` pour le form de chaque
 * instance, et `ActivityPersistenceService` pour l'activité de pool
 * référencée) : ce service ne gère que les *références*, dans l'ordre.
 */
@Injectable({ providedIn: 'root' })
export class DayActivitiesPersistenceService
  extends DebounceWriter<string, DayActivitiesUpdate> {
  private readonly db = inject(FirebaseService).db;

  constructor() { super(); }

  queueUpdate(tripId: string, dayId: Date, activityIds: string[]) {
    const key = `${tripId}_${dayId.getTime()}`;
    this.queue(key, { key, tripId, dayId, activityIds });
  }

  protected override write(updates: DayActivitiesUpdate[]) {
    return Promise.all(
      updates.map((u) =>
        updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
          [`days.${u.dayId.getTime()}.activityIds`]: u.activityIds,
        })
      )
    );
  }
}
