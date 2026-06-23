import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { Trip } from './trip.model';
import { Activity } from './trip-detail/day-panel/activity-card/activity.model';
import { Item } from './trip-detail/infos/info.models';
import { TripStore } from './trip-store.service';
import { TripRepository } from '@app/core/infra/firebase/services/trip-repository';

@Injectable()
export class TripFacade {
  private readonly store = inject(TripStore);
  private readonly repo = inject(TripRepository);

  private tripSub: Subscription | null = null;

  // ── Signaux exposés aux composants ────────────────────────────────────────
  readonly trips = this.store.trips;
  readonly tripsLoading = this.store.tripsLoading;
  readonly activeTrip = this.store.activeTrip;
  readonly activeTripLoading = this.store.activeTripLoading;

  constructor() {
    this.repo.getTrips$().subscribe((trips) => {
      this.store._tripsResult.set(trips);
    });
  }

  // ── Chargement du trip actif ──────────────────────────────────────────────

  loadTrip(id: string): void {
    this.tripSub?.unsubscribe();
    this.store._activeTripId.set(id);
    this.store.activeTripLoading.set(true);

    this.tripSub = this.repo.getTrip$(id).subscribe({
      next: (trip) => {
        if (!this.store.hasTrip(trip.id)) {
          this.hydrate(trip);
        } else {
          this.mergeFromRemote(trip);
        }
        // set après le cycle CD en cours
        Promise.resolve().then(() => this.store.activeTripLoading.set(false));
      },
      error: (err) => {
        console.error('[TripFacade] getTrip$ error', err);
        // set après le cycle CD en cours
        Promise.resolve().then(() => this.store.activeTripLoading.set(false));
      },
    });
  }

  unloadTrip(): void {
    this.tripSub?.unsubscribe();
    this.tripSub = null;
    this.store._activeTripId.set(null);
  }

  // ── Commandes ─────────────────────────────────────────────────────────────

  saveTrip(trip: Trip): void {
    this.store.saveTrip(trip);
  }

  updateTrip(trip: Trip): void {
    this.store.updateTrip(trip);
  }

  createActivity(tripId: string, dayId: Date, activity: Activity): void {
    this.store.createActivity(tripId, dayId, activity);
  }

  updateActivity(tripId: string, dayId: Date, activity: Activity): void {
    this.store.updateActivity(tripId, dayId, activity);
  }

  removeActivity(tripId: string, dayId: Date, activityId: string): void {
    this.store.removeActivity(tripId, dayId, activityId);
  }

  reorderActivities(tripId: string, dayId: Date, ids: string[]): void {
    this.store.reorderActivities(tripId, dayId, ids);
  }

  createItem(tripId: string, item: Item): void {
    this.store.createItem(tripId, item);
  }

  updateItem(tripId: string, itemId: string, patch: Partial<Item>): void {
    this.store.updateItem(tripId, itemId, patch);
  }

  removeItem(tripId: string, itemId: string): void {
    this.store.removeItem(tripId, itemId);
  }

  reorderItems(tripId: string, ids: string[]): void {
    this.store.reorderItems(tripId, ids);
  }

  getActivities = this.store.getActivities.bind(this.store);
  getActivity = this.store.getActivity.bind(this.store);
  getInfoItems = this.store.getInfoItems.bind(this.store);

  // ── Hydratation ───────────────────────────────────────────────────────────

  private hydrate(trip: Trip): void {
    const newTrips = { ...this.store._trips() };
    const newDays: Record<string, any> = {};
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

    this.store._trips.set(newTrips);
    this.store._days.set(newDays);
    this.store._activities.set(newActivities);
    this.store._tripDays.set(newTripDays);
    this.store._dayActivities.set(newDayActivities);
    this.store._infoItems.set(infoItems);
    this.store._tripInfoItems.set(tripInfoItems);
  }

  private mergeFromRemote(trip: Trip): void {
    const currentActivities = this.store._activities();
    const newActivities: Record<string, Activity> = {};
    const newDayActivities: Record<string, string[]> = {};

    for (const day of trip.days) {
      const dayKey = day.id.toISOString();
      newDayActivities[dayKey] = [];

      for (const activity of day.activities) {
        const current = currentActivities[activity.id];
        newActivities[activity.id] =
          current && JSON.stringify(current) === JSON.stringify(activity)
            ? current
            : activity;
        newDayActivities[dayKey].push(activity.id);
      }
    }

    this.store._activities.set(newActivities);
    this.store._dayActivities.set(newDayActivities);
  }
}