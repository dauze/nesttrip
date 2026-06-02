import {Injectable} from '@angular/core/types/core';
import {inject} from '@angular/core/types/primitives-di';
import {Observable, from} from 'rxjs/dist/types/index';
import {activityToFb} from '@core/mapper/firebase.mapper';
import {Activity} from './activity.interface';

@Injectable({providedIn: 'root'})
export class ActivityService {
  private readonly travelService = inject(TravelService);

  createActivity(tripId: number, dayId: Date, activity: Activity): Observable<void> {
    return from(updateDoc(this.travelService.tripRef(tripId), {
      [`days.${dayId.getTime()}.activities`]: arrayUnion(activityToFb(activity))
    }));
  }

  updateActivity(tripId: number, dayId: Date, activity: Activity, currentActivities: Activity[]): Observable<void> {
    const updated = currentActivities
      .map(a => a.id === activity.id ? {...a, ...activity} : a)
      .map(a => activityToFb(a));
    return from(updateDoc(this.travelService.tripRef(tripId), {
      [`days.${dayId.getTime()}.activities`]: updated
    }));
  }

  removeActivity(tripId: number, dayId: Date, activityId: number, currentActivities: Activity[]): Observable<void> {
    const updated = currentActivities
      .filter(a => a.id !== activityId)
      .map(a => activityToFb(a));
    return from(updateDoc(this.travelService.tripRef(tripId), {
      [`days.${dayId.getTime()}.activities`]: updated
    }));
  }

  reorderActivities(tripId: number, dayId: Date, reorderedActivities: Activity[]): Observable<void> {
    return from(updateDoc(this.travelService.tripRef(tripId), {
      [`days.${dayId.getTime()}.activities`]: reorderedActivities.map(activityToFb)
    }));
  }
}
