import { inject, Injectable } from '@angular/core';
import { activityToFb } from '@core/infra/firebase/mappers/activity.mapper';
import { TravelFirestoreService } from '@core/infra/firebase/services/travel.firebase.service';
import { BasePersistenceService } from './base.persistence.service';
import { Activity } from '@app/features/trips/trip-detail/day-panel/activity-card/activity.model';

type ActivityUpdate = {
  key: string;
  tripId: string;
  dayId: Date;
  activities: Activity[];
};

@Injectable({ providedIn: 'root' })
export class ActivityPersistenceService
  extends BasePersistenceService<string, ActivityUpdate> {

  private readonly firestore = inject(TravelFirestoreService);

  constructor() { super(); }

  queueUpdate(tripId: string, dayId: Date, activities: Activity[]) {
    this.queue(`${tripId}_${dayId.getTime()}`, { key: `${tripId}_${dayId.getTime()}`, tripId, dayId, activities });
  }

  protected override write(updates: ActivityUpdate[]) {
    return Promise.all(
      updates.map((u) =>
        this.firestore.updateActivities(u.tripId, u.dayId, u.activities.map(activityToFb))
      )
    );
  }
}
