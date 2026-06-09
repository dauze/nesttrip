import { inject, Injectable, signal } from '@angular/core';
import { activityToFb } from '@core/infra/firebase/mappers/activity.mapper';
import { EMPTY, from, Subject } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';
import { TravelFirestoreService } from '@core/infra/firebase/services/travel.firebase.service';

type Key = string;

type PendingUpdate = {
  tripId: number;
  dayId: Date;
  activities: any[];
};

@Injectable({ providedIn: 'root' })
export class ActivityPersistenceService {
  private readonly firestore = inject(TravelFirestoreService);

  // ✅ état de sync exposé (UX)
  readonly syncing = signal(false);

  // ✅ MAP pour déduplication (1 seul update par clé)
  private readonly pending = new Map<Key, PendingUpdate>();

  // ✅ flux RxJS standard
  private readonly trigger$ = new Subject<void>();

  constructor() {
    this.trigger$
      .pipe(
        debounceTime(300), // ✅ standard RXJS
        tap(() => this.syncing.set(true)),
        switchMap(() => this.flush()),
        tap(() => this.syncing.set(false)),
      )
      .subscribe();
  }

  queueUpdate(tripId: number, dayId: Date, activities: any[]) {
    const key = this.key(tripId, dayId);

    // ✅ overwrite previous (dedup)
    this.pending.set(key, {
      tripId,
      dayId,
      activities,
    });

    this.trigger$.next();
  }

  private flush() {
    if (this.pending.size === 0) {
      return EMPTY;
    }

    const updates = Array.from(this.pending.values());
    this.pending.clear();

    return from(
      Promise.all(
        updates.map((u) =>
          this.firestore.updateActivities(u.tripId, u.dayId, u.activities.map(activityToFb)),
        ),
      ),
    ).pipe(
      catchError((err) => {
        console.error('Persistence failed, retry later', err);

        updates.forEach((u) => this.pending.set(this.key(u.tripId, u.dayId), u));

        return EMPTY;
      }),
    );
  }

  private key(tripId: number, dayId: Date): Key {
    return `${tripId}_${dayId.getTime()}`;
  }
}
