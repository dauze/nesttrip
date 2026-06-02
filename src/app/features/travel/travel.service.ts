// travel.service.ts
import {Injectable, Signal, inject, signal} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    DocumentReference,
} from 'firebase/firestore';
import {from, Observable, switchMap, EMPTY} from 'rxjs';
import {FirebaseService} from '@core/infra/firebase/firebase.service';

@Injectable({providedIn: 'root'})
export class TravelService {
  //TODO remplacer trips par travels
    private readonly db = inject(FirebaseService).db;

    readonly activeTravelId = signal<number>(0);

    readonly trips: Signal<Pick<Travel, 'id' | 'title'>[]> = toSignal(
        new Observable<Pick<Travel, 'id' | 'title'>[]>(observer => {
            const unsub = onSnapshot(
                query(collection(this.db, 'trips')),
                snap => observer.next(
                    snap.docs.map(d => {
                        const {id, title} = d.data() as TravelFirebase;
                        return {id, title};
                    })
                ),
                err => observer.error(err)
            );
            return () => unsub();
        }),
        {initialValue: []}
    );

    readonly activeTravel: Signal<Travel | undefined> = toSignal(
        toObservable(this.activeTravelId).pipe(
            switchMap(id =>
                id
                    ? new Observable<Travel>(observer => {
                        const unsub = onSnapshot(
                            doc(this.db, 'trips', id.toString()),
                            snap => {
                                const data = snap.data();
                                if (data) observer.next(travelFromFb(data as TravelFirebase));
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

    createTravel(Travel: Travel): Observable<void> {
        return from(setDoc(this.tripRef(Travel.id), travelToFb(Travel)));
    }

    deleteTravel(tripId: number): Observable<void> {
        return from(deleteDoc(this.tripRef(tripId)));
    }
}
