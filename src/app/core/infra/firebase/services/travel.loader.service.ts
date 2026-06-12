import { effect, inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { Travel } from '@app/features/trips/travel.model';
import { Activity } from '@app/features/trips/trip-detail/day-panel/activity-card/activity.model';
import { Item } from '@app/features/trips/trip-detail/infos/info.models';
import { TripStore } from '@app/features/trips/travel.store';
import { TravelDataSource } from './trip.persistence.service';


@Injectable({ providedIn: 'root' })
export class TravelLoaderService {
  private readonly dataSource = inject(TravelDataSource);
  private readonly tripStore = inject(TripStore);

  private travelSub: Subscription | null = null;
  private readonly hydrated = new Set<string>();

  constructor() {
    effect(() => {
      const id = this.tripStore._activeTravelId();
      this.travelSub?.unsubscribe();

      if (!id) {
        this.tripStore.activeTravelLoading.set(false);
        return;
      }

      this.tripStore.activeTravelLoading.set(true);

      this.travelSub = this.dataSource.getTravel$(id).subscribe((travel) => {
        if (!this.hydrated.has(travel.id)) {
          this.hydrate(travel);
          this.hydrated.add(travel.id);
        } else {
          this.mergeFromRemote(travel);
        }
        this.tripStore.activeTravelLoading.set(false);
      });
    });

    this.dataSource.getTrips$().subscribe(trips => {
      this.tripStore._tripsResult.set(trips);
    });
  }

  // ── Hydratation initiale ──────────────────────────────────────────────────

  private hydrate(travel: Travel): void {
    const newTravels = { ...this.tripStore._travels() };
    const newDays: Record<string, ReturnType<typeof this.tripStore._days>[string]> = {};
    const newActivities: Record<string, Activity> = {};
    const newTravelDays: Record<string, string[]> = {};
    const newDayActivities: Record<string, string[]> = {};
    const infoItems: Record<string, Item> = {};
    const travelInfoItems: Record<string, string[]> = {};

    newTravels[travel.id] = { ...travel, days: [] };
    newTravelDays[travel.id] = [];
    travelInfoItems[travel.id] = [];

    for (const item of travel.info.items) {
      infoItems[item.id] = item;
      travelInfoItems[travel.id].push(item.id);
    }

    for (const day of travel.days) {
      const dayKey = day.id.toISOString();

      newDays[dayKey] = { ...day, activities: [] };
      newTravelDays[travel.id].push(dayKey);
      newDayActivities[dayKey] = [];

      for (const activity of day.activities) {
        newActivities[activity.id] = activity;
        newDayActivities[dayKey].push(activity.id);
      }
    }

    this.tripStore._travels.set(newTravels);
    this.tripStore._days.set(newDays);
    this.tripStore._activities.set(newActivities);
    this.tripStore._travelDays.set(newTravelDays);
    this.tripStore._dayActivities.set(newDayActivities);
    this.tripStore._infoItems.set(infoItems);
    this.tripStore._travelInfoItems.set(travelInfoItems);
  }

  // ── Merge remote (mise à jour temps réel) ────────────────────────────────
  private mergeFromRemote(travel: Travel): void {
    const currentActivities = this.tripStore._activities();
    const newActivities: Record<string, Activity> = {};
    const newDayActivities: Record<string, string[]> = {};

    for (const day of travel.days) {
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