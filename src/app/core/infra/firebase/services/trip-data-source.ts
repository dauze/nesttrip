import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { TripFirebase } from '@app/core/infra/firebase/models/trip.dto';
import { tripFromFb } from '@app/core/infra/firebase/mappers/trip.mapper';
import { Trip } from '@app/features/trips/trip.model';
import { AuthService } from '@app/core/services/auth.service';

@Injectable({ providedIn: 'root' })
export class TripDataSource {
  private readonly db = inject(FirebaseService).db;
private readonly authService = inject(AuthService);
  

getTrips$(): Observable<Pick<Trip, 'id' | 'title'>[]> {
  return new Observable((observer) => {
    const user = this.authService.getCurrentUser(); // lecture directe, Firebase garantit qu'il est résolu après le guard
    if (!user) { observer.error('User not authenticated'); return; }

    const unsub = onSnapshot(
      query(collection(this.db, 'trips'), where(`members.${user.uid}`, '!=', null)),
      (snap) => observer.next(snap.docs.map((d) => {
        const { id, title } = d.data() as TripFirebase;
        return { id, title };
      })),
      (err) => observer.error(err)
    );
    return () => unsub();
  });
}
  getTrip$(id: string) {
    return new Observable<Trip>((observer) => {
      const unsub = onSnapshot(
        doc(this.db, 'trips', id.toString()),
        (snap) => {
          const data = snap.data();
          if (data) {
            observer.next(tripFromFb(data as TripFirebase));
          }
        },
        (err) => observer.error(err),
      );
      return () => unsub();
    });
  }
}
