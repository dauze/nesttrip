import { inject, Injectable, signal } from '@angular/core';
import { EMPTY, from, Subject } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';
import { Item } from '@app/features/travel/infos/info.models';
import { TravelFirestoreService } from '@core/infra/firebase/services/travel.firebase.service';

type Key = number;

type PendingUpdate = {
  tripId: number;
  items: Item[];
};

@Injectable({ providedIn: 'root' })
export class InfoPersistenceService {
  private readonly firestore = inject(TravelFirestoreService);

  // ✅ status exposé (optionnel UI)
  readonly syncing = signal(false);

  // ✅ dedup (1 update par trip)
  private readonly pending = new Map<Key, PendingUpdate>();

  private readonly trigger$ = new Subject<void>();

  constructor() {
    this.trigger$
      .pipe(
        debounceTime(300),
        tap(() => this.syncing.set(true)),
        switchMap(() => this.flush()),
        tap(() => this.syncing.set(false)),
      )
      .subscribe();
  }

  // ✅ appelé par le store
  queueUpdate(tripId: number, items: Item[]) {
    this.pending.set(tripId, { tripId, items });
    this.trigger$.next();
  }

  // ✅ flush batch
  private flush() {
    if (this.pending.size === 0) {
      return EMPTY;
    }

    const updates = Array.from(this.pending.values());
    this.pending.clear();

    return from(Promise.all(updates.map((u) => this.firestore.updateInfo(u.tripId, u.items)))).pipe(
      catchError((err) => {
        console.error('Persistence failed, retry later', err);

        updates.forEach((u) => this.pending.set(this.key(u.tripId), u));
        return EMPTY;
      }),
    );
  }
  private key(tripId: number): string {
    return `info_${tripId}`;
  }
}
