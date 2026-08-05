// src/app/core/infra/firebase/services/trip-data-source.ts
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { TripFirebase } from '@app/core/infra/firebase/models/trip.dto';
import { tripFromFb } from '@app/core/infra/firebase/mappers/trip.mapper';
import { Trip, TripSummary } from '@app/features/trips/trip.model';
import { AuthService } from '@app/core/services/auth.service';

@Injectable()
export class TripDataSource {
  private readonly db = inject(FirebaseService).db;
  private readonly authService = inject(AuthService);

  getTrips$(): Observable<TripSummary[]> {
    return new Observable((observer) => {
      const user = this.authService.getCurrentUser(); // lecture directe, Firebase garantit qu'il est résolu après le guard
      if (!user) { observer.error('User not authenticated'); return; }

      const unsub = onSnapshot(
        query(collection(this.db, 'trips'), where(`members.${user.uid}`, '!=', null)),
        (snap) => observer.next(snap.docs.map((d) => {
          const { id, title, ownerId, days } = d.data() as TripFirebase;
          // Bornes de l'intervalle de jours, directement depuis les clés du
          // map Firestore (`getTime()` en string, voir CLAUDE.md) — pas
          // besoin du mapper complet (`tripFromFb`) juste pour ça, cette
          // projection reste volontairement légère (voir TripSummary).
          const dayKeys = Object.keys(days ?? {}).map(Number);
          const dayRange = dayKeys.length
            ? { earliestDay: new Date(Math.min(...dayKeys)), latestDay: new Date(Math.max(...dayKeys)) }
            : {};
          return { id, title, ownerId, ...dayRange };
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
          } else {
            // Doc supprimé (ou id invalide) : on notifie explicitement plutôt
            // que de laisser l'observer silencieux indéfiniment.
            observer.error(new Error(`Trip ${id} not found`));
          }
        },
        (err) => observer.error(err),
      );
      return () => unsub();
    });
  }
}