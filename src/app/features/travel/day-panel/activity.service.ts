import { TravelService } from '@features/travel/travel.service';
import { inject, Injectable } from '@angular/core';
import { Activity } from '@features/travel/day-panel/activity.model';
import { from, Observable } from 'rxjs';
import { arrayUnion, updateDoc } from 'firebase/firestore';
import { activityToFb } from '@core/infra/firebase/mappers/activity.mapper';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly travelService = inject(TravelService);

  createActivity(tripId: number, dayId: Date, activity: Activity): Observable<void> {
    return from(
      updateDoc(this.travelService.tripRef(tripId), {
        [`days.${dayId.getTime()}.activities`]: arrayUnion(activityToFb(activity)),
      }),
    );
  }

  updateActivity(
    tripId: number,
    dayId: Date,
    activity: Activity,
    currentActivities: Activity[],
  ): Observable<void> {
    const updated = currentActivities
      .map((a) => (a.id === activity.id ? { ...a, ...activity } : a))
      .map((a) => activityToFb(a));
    return from(
      updateDoc(this.travelService.tripRef(tripId), {
        [`days.${dayId.getTime()}.activities`]: updated,
      }),
    );
  }

  removeActivity(
    tripId: number,
    dayId: Date,
    activityId: number,
    currentActivities: Activity[],
  ): Observable<void> {
    const updated = currentActivities
      .filter((a) => a.id !== activityId)
      .map((a) => activityToFb(a));
    return from(
      updateDoc(this.travelService.tripRef(tripId), {
        [`days.${dayId.getTime()}.activities`]: updated,
      }),
    );
  }

  reorderActivities(
    tripId: number,
    dayId: Date,
    reorderedActivities: Activity[],
  ): Observable<void> {
    return from(
      updateDoc(this.travelService.tripRef(tripId), {
        [`days.${dayId.getTime()}.activities`]: reorderedActivities.map(activityToFb),
      }),
    );
  }
}
