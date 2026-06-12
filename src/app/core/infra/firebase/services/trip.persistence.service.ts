import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { TravelFirebase } from '@core/infra/firebase/models/travel.dto';
import { travelFromFb } from '@core/infra/firebase/mappers/travel.mapper';
import { Travel } from '@app/features/trips/travel.model';

@Injectable({ providedIn: 'root' })
export class TravelDataSource {
  private readonly db = inject(FirebaseService).db;

  getTrips$() {
    return new Observable<Pick<Travel, 'id' | 'title'>[]>((observer) => {
      const unsub = onSnapshot(
        query(collection(this.db, 'trips')),
        (snap) =>
          observer.next(
            snap.docs.map((d) => {
              const { id, title } = d.data() as TravelFirebase;
              return { id, title };
            }),
          ),
        (err) => observer.error(err),
      );
      return () => unsub();
    });
  }

  getTravel$(id: string) {
    return new Observable<Travel>((observer) => {
      const unsub = onSnapshot(
        doc(this.db, 'trips', id.toString()),
        (snap) => {
          const data = snap.data();
          if (data) {
            observer.next(travelFromFb(data as TravelFirebase));
          }
        },
        (err) => observer.error(err),
      );
      return () => unsub();
    });
  }
}
