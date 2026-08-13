import { inject, Injectable } from '@angular/core';
import { deleteDoc, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { Trip, TravelTiers } from '@app/features/trips/trip.model';
import { tripToFb } from '@core/infra/firebase/mappers/trip.mapper';
import { TravelMode } from '@app/features/trips/trip-detail/trip-day-swiper/day-panel/day-distance-gap/travel-mode.util';

@Injectable({ providedIn: 'root' })
export class TripPersistenceService {
  private readonly db = inject(FirebaseService).db;

  createTrip(trip: Trip): Promise<void> {
    return setDoc(doc(this.db, 'trips', trip.id), tripToFb(trip));
  }
  
  updateTripTitle(tripId: string, title: string): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), { title });
  }

  updateTripTravelTiers(tripId: string, tiers: TravelTiers): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), { travelTiers: tiers });
  }

  updateTripTravelModeOverrides(tripId: string, overrides: Record<string, TravelMode>): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), { travelModeOverrides: overrides });
  }

  updateTripAdditionalCities(tripId: string, cities: string[]): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), { additionalCities: cities });
  }

  /** `photoRef` explicitement effacé (`deleteField()`, jamais `undefined` — Firestore le rejette) quand la nouvelle destination n'a retrouvé aucune photo : une ancienne vignette sans rapport avec la nouvelle destination ne doit pas rester. */
  updateTripDestination(tripId: string, destination: { ville: string; placeId: string; photoRef?: string }): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      ville: destination.ville,
      placeId: destination.placeId,
      photoRef: destination.photoRef ?? deleteField(),
    });
  }

  removeTrip(tripId: string): Promise<void> {
    return deleteDoc(doc(this.db, 'trips', tripId));
  }

}