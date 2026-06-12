import { effect, inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { Travel } from '@app/features/trips/travel.model';
import { Activity } from '@app/features/trips/trip-detail/day-panel/activity-card/activity.model';
import { Item } from '@app/features/trips/trip-detail/infos/info.models';
import { TravelStore } from '@app/features/trips/travel.store';
import { TravelDataSource } from './trip.persistence.service';


@Injectable({ providedIn: 'root' })
export class TravelLoaderService {
  private readonly dataSource = inject(TravelDataSource);
  private readonly store = inject(TravelStore);

  private travelSub: Subscription | null = null;
  private readonly hydrated = new Set<string>();

  constructor() {
    effect(() => {
      const id = this.store._activeTravelId();
      this.travelSub?.unsubscribe();

      if (!id) {
        this.store.activeTravelLoading.set(false);
        return;
      }

      this.store.activeTravelLoading.set(true);

      this.travelSub = this.dataSource.getTravel$(id).subscribe((travel) => {
        if (!this.hydrated.has(travel.id)) {
          this.hydrate(travel);
          this.hydrated.add(travel.id);
        } else {
          this.mergeFromRemote(travel);
        }
        this.store.activeTravelLoading.set(false);
      });
    });

    this.dataSource.getTrips$().subscribe(trips => {
      this.store._tripsResult.set(trips);
    });
  }

  // ── Hydratation initiale ──────────────────────────────────────────────────

  private hydrate(travel: Travel): void {
    const newTravels = { ...this.store._travels() };
    const newDays: Record<string, ReturnType<typeof this.store._days>[string]> = {};
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

    this.store._travels.set(newTravels);
    this.store._days.set(newDays);
    this.store._activities.set(newActivities);
    this.store._travelDays.set(newTravelDays);
    this.store._dayActivities.set(newDayActivities);
    this.store._infoItems.set(infoItems);
    this.store._travelInfoItems.set(travelInfoItems);
  }

  // ── Merge remote (mise à jour temps réel) ────────────────────────────────
  private mergeFromRemote(travel: Travel): void {
    const currentActivities = this.store._activities();
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

    this.store._activities.set(newActivities);
    this.store._dayActivities.set(newDayActivities);
  }
}