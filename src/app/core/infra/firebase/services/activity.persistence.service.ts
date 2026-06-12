import { inject, Injectable } from '@angular/core';
import { activityToFb } from '@core/infra/firebase/mappers/activity.mapper';
import { BasePersistenceService } from './base.persistence.service';
import { Activity } from '@app/features/trips/trip-detail/day-panel/activity-card/activity.model';
import { updateDoc, doc } from 'firebase/firestore';
import { FirebaseService } from '../firebase.service';

type ActivityUpdate = {
  key: string;
  tripId: string;
  dayId: Date;
  activities: Activity[];
};

@Injectable({ providedIn: 'root' })
export class ActivityPersistenceService
  extends BasePersistenceService<string, ActivityUpdate> {
  private readonly db = inject(FirebaseService).db;

  constructor() { super(); }

  queueUpdate(tripId: string, dayId: Date, activities: Activity[]) {
    this.queue(`${tripId}_${dayId.getTime()}`, { key: `${tripId}_${dayId.getTime()}`, tripId, dayId, activities });
  }

  protected override write(updates: ActivityUpdate[]) {
    return Promise.all(
      updates.map((u) =>
        updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
              [`days.${u.dayId.getTime()}.activities`]: u.activities.map(activityToFb),
            })
      )
    );
  }
}
