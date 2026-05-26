// activity.service.ts
import { Injectable, inject } from '@angular/core';
import { Activity } from '../models/dto/activity.interface';
import { updateDoc, arrayUnion } from 'firebase/firestore';
import { from, Observable } from 'rxjs';
import { TripService } from './trip.service';
import { activityToFb } from '../mapper/firebase.mapper';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly tripService = inject(TripService);

  createActivity(tripId: number, dayId: Date, activity: Activity): Observable<void> {
    return from(updateDoc(this.tripService.tripRef(tripId), {
      [`days.${dayId.getTime()}.activities`]: arrayUnion(activityToFb(activity))
    }));
  }

  updateActivity(tripId: number, dayId: Date, activity: Activity, currentActivities: Activity[]): Observable<void> {
    const updated = currentActivities
      .map(a => a.id === activity.id ? { ...a, ...activity } : a)
      .map(a => activityToFb(a));
    return from(updateDoc(this.tripService.tripRef(tripId), {
      [`days.${dayId.getTime()}.activities`]: updated
    }));
  }

  removeActivity(tripId: number, dayId: Date, activityId: number, currentActivities: Activity[]): Observable<void> {
    const updated = currentActivities
      .filter(a => a.id !== activityId)
      .map(a => activityToFb(a));
    return from(updateDoc(this.tripService.tripRef(tripId), {
      [`days.${dayId.getTime()}.activities`]: updated
    }));
  }
}