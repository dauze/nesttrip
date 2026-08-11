import { Observable } from 'rxjs';
import { TripAiPreferences } from '@app/features/trips/new-trip/trip-ai-preferences.model';
import { TripGeneration } from '@app/features/trips/new-trip/trip-generation.model';

export abstract class TripGenerationRepository {
  /** `null` tant que le doc n'existe pas encore (avant la création côté client) — jamais une erreur, contrairement à `TripRepository.getTrip$`. */
  abstract watch$(tripId: string): Observable<TripGeneration | null>;
  abstract create(job: TripGeneration): Promise<void>;
  /** "Régénérer tout" (§2.5) : repasse le job en `generating`, préférences éventuellement modifiées — la Cloud Function (déclenchée par cette écriture) recalcule `candidates`/`preview`. */
  abstract regenerate(tripId: string, preferences: TripAiPreferences): Promise<void>;
}
