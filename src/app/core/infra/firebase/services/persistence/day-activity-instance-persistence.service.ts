import { inject, Injectable } from '@angular/core';
import { dayActivityInstanceToFb } from '@core/infra/firebase/mappers/day-activity-instance.mapper';
import { DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';

interface DayActivityInstanceUpdate {
  key: string;
  tripId: string;
  instance: DayActivityInstance;
}

/**
 * Persiste chaque instance (form d'une activité rattachée à un jour) individuellement
 * dans `trips/{tripId}.dayActivityInstances.{instanceId}`. Une même activité de pool
 * (`instance.activityId`) peut avoir plusieurs instances indépendantes, une par jour.
 */
@Injectable({ providedIn: 'root' })
export class DayActivityInstancePersistenceService
  extends DebounceWriter<string, DayActivityInstanceUpdate> {
  private readonly db = inject(FirebaseService).db;

  constructor() { super(); }

  queueUpdate(tripId: string, instance: DayActivityInstance) {
    const key = `${tripId}_${instance.id}`;
    this.queue(key, { key, tripId, instance });
  }

  protected override write(updates: DayActivityInstanceUpdate[]) {
    return Promise.all(
      updates.map((u) =>
        updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
          [`dayActivityInstances.${u.instance.id}`]: dayActivityInstanceToFb(u.instance),
        })
      )
    );
  }

  /** Suppression immédiate (non débouncée) d'une instance. */
  removeInstance(tripId: string, instanceId: string): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`dayActivityInstances.${instanceId}`]: deleteField(),
    });
  }
}
