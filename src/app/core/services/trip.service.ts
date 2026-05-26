// trip.service.ts
import { Injectable, Signal, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from './firebase.service';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  DocumentReference,
} from 'firebase/firestore';
import { from, Observable, switchMap, EMPTY } from 'rxjs';
import { Trip } from '../models/dto/trip.interface';
import { TripFirebase } from '../models/firebase/trip.models';
import { tripfromFb, tripToFb } from '../mapper/firebase.mapper';

@Injectable({ providedIn: 'root' })
export class TripService {
  private readonly db = inject(FirebaseService).db;

  readonly activeTripId = signal<number>(0);

  readonly trips: Signal<Pick<Trip, 'id' | 'title'>[]> = toSignal(
    new Observable<Pick<Trip, 'id' | 'title'>[]>(observer => {
      const unsub = onSnapshot(
        query(collection(this.db, 'trips')),
        snap => observer.next(
          snap.docs.map(d => {
            const { id, title } = d.data() as TripFirebase;
            return { id, title };
          })
        ),
        err => observer.error(err)
      );
      return () => unsub();
    }),
    { initialValue: [] }
  );

  readonly activeTrip: Signal<Trip | undefined> = toSignal(
    toObservable(this.activeTripId).pipe(
      switchMap(id =>
        id
          ? new Observable<Trip>(observer => {
              const unsub = onSnapshot(
                doc(this.db, 'trips', id.toString()),
                snap => {
                  const data = snap.data();
                  if (data) observer.next(tripfromFb(data as TripFirebase));
                },
                err => observer.error(err)
              );
              return () => unsub();
            })
          : EMPTY
      )
    )
  );

  tripRef(tripId: number): DocumentReference {
    return doc(this.db, 'trips', tripId.toString());
  }

  createTrip(trip: Trip): Observable<void> {
    return from(setDoc(this.tripRef(trip.id), tripToFb(trip)));
  }

  deleteTrip(tripId: number): Observable<void> {
    return from(deleteDoc(this.tripRef(tripId)));
  }
}