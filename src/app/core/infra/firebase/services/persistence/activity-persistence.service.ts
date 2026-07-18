import { inject, Injectable } from '@angular/core';
import { activityToFb } from '@core/infra/firebase/mappers/activity.mapper';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';

interface ActivityUpdate {
  key: string;
  tripId: string;
  activity: Activity;
}

/**
 * Persiste chaque activité individuellement dans le pool plat
 * `trips/{tripId}.activities.{activityId}` — source de vérité unique,
 * qu'elle soit rattachée à un jour ou non (vue générale). Les jours ne
 * stockent que des références (`activityIds`), gérées par
 * `DayActivitiesPersistenceService`.
 */
@Injectable({ providedIn: 'root' })
export class ActivityPersistenceService
  extends DebounceWriter<string, ActivityUpdate> {
  private readonly db = inject(FirebaseService).db;

  constructor() { super(); }

  queueUpdate(tripId: string, activity: Activity) {
    const key = `${tripId}_${activity.id}`;
    this.queue(key, { key, tripId, activity });
  }

  protected override write(updates: ActivityUpdate[]) {
    return Promise.all(
      updates.map((u) =>
        updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
          [`activities.${u.activity.id}`]: activityToFb(u.activity),
        })
      )
    );
  }

  /** Suppression immédiate (non débouncée) du pool d'activités du trip. */
  removeActivity(tripId: string, activityId: string): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`activities.${activityId}`]: deleteField(),
    });
  }
}
