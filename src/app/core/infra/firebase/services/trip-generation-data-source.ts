import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { TripGenerationFirebase } from '@app/core/infra/firebase/models/trip-generation.dto';
import { tripGenerationFromFb, tripGenerationToFb } from '@app/core/infra/firebase/mappers/trip-generation.mapper';
import { TripAiPreferences } from '@app/features/trips/new-trip/trip-ai-preferences.model';
import { TripGeneration } from '@app/features/trips/new-trip/trip-generation.model';
import { TripGenerationRepository } from './trip-generation-repository';

/**
 * `tripGenerations/{tripId}` : collection séparée de `trips/{tripId}` (voir
 * doc de `TripGeneration`) — un seul doc par trip, créé côté client
 * (déclenche la Cloud Function `onDocumentWritten`, voir functions/src/
 * trip-generation/generate-trip.trigger.ts), puis mis à jour uniquement côté
 * serveur (Admin SDK) jusqu'à `ready_for_preview`/`failed`.
 */
@Injectable({ providedIn: 'root' })
export class TripGenerationDataSource extends TripGenerationRepository {
  private readonly db = inject(FirebaseService).db;

  watch$(tripId: string): Observable<TripGeneration | null> {
    return new Observable((observer) => {
      const unsub = onSnapshot(
        doc(this.db, 'tripGenerations', tripId),
        (snap) => {
          const data = snap.data();
          observer.next(data ? tripGenerationFromFb(data as TripGenerationFirebase) : null);
        },
        (err) => observer.error(err),
      );
      return () => unsub();
    });
  }

  create(job: TripGeneration): Promise<void> {
    return setDoc(doc(this.db, 'tripGenerations', job.tripId), tripGenerationToFb(job));
  }

  regenerate(tripId: string, preferences: TripAiPreferences): Promise<void> {
    return updateDoc(doc(this.db, 'tripGenerations', tripId), {
      status: 'generating',
      preferences,
      candidates: [],
      preview: [],
      updatedAt: Date.now(),
    });
  }
}
