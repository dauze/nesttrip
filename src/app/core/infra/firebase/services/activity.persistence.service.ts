import { inject, Injectable, signal } from '@angular/core';
import { activityToFb } from '@core/infra/firebase/mappers/activity.mapper';
import { EMPTY, from, Subject } from 'rxjs';
import { catchError, debounceTime, finalize, switchMap, tap } from 'rxjs/operators';
import { TravelFirestoreService } from '@core/infra/firebase/services/travel.firebase.service';
import { Activity } from '@app/features/travel/day-panel/activity.model';
import { BasePersistenceService } from './base.persistence.service';

type ActivityUpdate = {
  key: string;
  tripId: number;
  dayId: Date;
  activities: Activity[];
};

@Injectable({ providedIn: 'root' })
export class ActivityPersistenceService
  extends BasePersistenceService<string, ActivityUpdate> {

  private readonly firestore = inject(TravelFirestoreService);

  constructor() { super(); }

  queueUpdate(tripId: number, dayId: Date, activities: Activity[]) {
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
