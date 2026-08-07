import { inject, Injectable } from '@angular/core';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
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

  updateTripCurrency(tripId: string, currency: string): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), { defaultCurrency: currency });
  }

  updateTripTravelTiers(tripId: string, tiers: TravelTiers): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), { travelTiers: tiers });
  }

  updateTripTravelModeOverrides(tripId: string, overrides: Record<string, TravelMode>): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), { travelModeOverrides: overrides });
  }

  removeTrip(tripId: string): Promise<void> {
    return deleteDoc(doc(this.db, 'trips', tripId));
  }

}