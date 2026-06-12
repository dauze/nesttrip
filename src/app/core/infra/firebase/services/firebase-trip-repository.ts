import { effect, inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { Trip } from '@app/features/trips/trip.model';
import { Activity } from '@app/features/trips/trip-detail/day-panel/activity-card/activity.model';
import { Item } from '@app/features/trips/trip-detail/infos/info.models';
import { TripDataSource } from './trip-data-source';
import { TripStore } from '@app/features/trips/trip-store.service';


@Injectable({ providedIn: 'root' })
export class FirebaseTripRepository {
  private readonly dataSource = inject(TripDataSource);
  private readonly tripStore = inject(TripStore);

  private tripSub: Subscription | null = null;

  constructor() {
    effect(() => {
      const id = this.tripStore._activeTripId();
      this.tripSub?.unsubscribe();

      if (!id) {
        this.tripStore.activeTripLoading.set(false);
        return;
      }

      this.tripStore.activeTripLoading.set(true);

      this.tripSub = this.dataSource.getTrip$(id).subscribe((trip) => {
        if (!this.tripStore.hasTrip(trip.id)) {
          this.hydrate(trip);
        } else {
          this.mergeFromRemote(trip);
        }
        this.tripStore.activeTripLoading.set(false);
      });
    });

    this.dataSource.getTrips$().subscribe(trips => {
      this.tripStore._tripsResult.set(trips);
    });
  }

  // ── Hydratation initiale ──────────────────────────────────────────────────

  private hydrate(trip: Trip): void {
    const newTrips = { ...this.tripStore._trips() };
    const newDays: Record<string, ReturnType<typeof this.tripStore._days>[string]> = {};
    const newActivities: Record<string, Activity> = {};
    const newTripDays: Record<string, string[]> = {};
    const newDayActivities: Record<string, string[]> = {};
    const infoItems: Record<string, Item> = {};
    const tripInfoItems: Record<string, string[]> = {};

    newTrips[trip.id] = { ...trip, days: [] };
    newTripDays[trip.id] = [];
    tripInfoItems[trip.id] = [];

    for (const item of trip.info.items) {
      infoItems[item.id] = item;
      tripInfoItems[trip.id].push(item.id);
    }

    for (const day of trip.days) {
      const dayKey = day.id.toISOString();

      newDays[dayKey] = { ...day, activities: [] };
      newTripDays[trip.id].push(dayKey);
      newDayActivities[dayKey] = [];

      for (const activity of day.activities) {
        newActivities[activity.id] = activity;
        newDayActivities[dayKey].push(activity.id);
      }
    }

    this.tripStore._trips.set(newTrips);
    this.tripStore._days.set(newDays);
    this.tripStore._activities.set(newActivities);
    this.tripStore._tripDays.set(newTripDays);
    this.tripStore._dayActivities.set(newDayActivities);
    this.tripStore._infoItems.set(infoItems);
    this.tripStore._tripInfoItems.set(tripInfoItems);
  }

  // ── Merge remote (mise à jour temps réel) ────────────────────────────────
  private mergeFromRemote(trip: Trip): void {
    const currentActivities = this.tripStore._activities();
    const newActivities: Record<string, Activity> = {};
    const newDayActivities: Record<string, string[]> = {};

    for (const day of trip.days) {
      const dayKey = day.id.toISOString();
      newDayActivities[dayKey] = [];

      for (const activity of day.activities) {
        const current = currentActivities[activity.id];

        // Réutilise la même référence si l'activité n'a pas changé → pas de re-render
        newActivities[activity.id] =
          current && JSON.stringify(current) === JSON.stringify(activity)
            ? current
            : activity;

        newDayActivities[dayKey].push(activity.id);
      }
    }

    this.tripStore._activities.set(newActivities);
    this.tripStore._dayActivities.set(newDayActivities);
  }
}