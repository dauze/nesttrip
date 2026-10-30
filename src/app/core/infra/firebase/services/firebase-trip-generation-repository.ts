import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TripGenerationRepository } from './trip-generation-repository';
import { TripGenerationDataSource } from './trip-generation-data-source';
import { TripAiPreferences } from '@app/features/trips/new-trip/trip-ai-preferences.model';
import { TripGeneration } from '@app/features/trips/new-trip/trip-generation.model';

@Injectable({ providedIn: 'root' })
export class FirebaseTripGenerationRepository extends TripGenerationRepository {
  private readonly dataSource = inject(TripGenerationDataSource);

  watch$(tripId: string): Observable<TripGeneration | null> {
    return this.dataSource.watch$(tripId);
  }

  create(job: TripGeneration): Promise<void> {
    return this.dataSource.create(job);
  }

  planSelectedActivities(tripId: string, candidateIds: string[]): Promise<void> {
    return this.dataSource.planSelectedActivities(tripId, candidateIds);
  }

  requestMoreActivities(tripId: string, selectedIds: string[], rejectedIds: string[]): Promise<void> {
    return this.dataSource.requestMoreActivities(tripId, selectedIds, rejectedIds);
  }

  regenerate(tripId: string, preferences: TripAiPreferences): Promise<void> {
    return this.dataSource.regenerate(tripId, preferences);
  }
}
