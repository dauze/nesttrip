import { computed, effect, inject, Injectable, Signal, signal } from '@angular/core';
import { Day, Travel } from '@features/travel/travel.model';
import { Activity } from '@features/travel/day-panel/activity.model';
import { TravelDataSource } from '@core/infra/firebase/services/travel.persistence.service';
import { ActivityPersistenceService } from '@core/infra/firebase/services/activity.persistence.service';
import { Item } from './infos/info.models';

type TravelEntities = Record<number, Travel>;
type DayEntities = Record<string, Day>; // key = ISO date
type ActivityEntities = Record<number, Activity>;

@Injectable({ providedIn: 'root' })
export class TravelStore {
  private readonly dataSource = inject(TravelDataSource);
  private readonly persistence = inject(ActivityPersistenceService);

  // ✅ STATE NORMALISÉ
  private readonly travels = signal<TravelEntities>({});
  private readonly days = signal<DayEntities>({});
  private readonly activities = signal<ActivityEntities>({});

  // ✅ RELATIONS (indexes)
  private readonly travelDays = signal<Record<number, string[]>>({});
  private readonly dayActivities = signal<Record<string, number[]>>({});
  private readonly infoItems = signal<Record<number, Item>>({});
  private readonly travelInfoItems = signal<Record<number, number[]>>({});

  // ✅ UI STATE
  readonly activeTravelId = signal<number | null>(null);

  // ✅ SELECTORS
  readonly activeTravel = computed(() => {
    const id = this.activeTravelId();
    return id ? this.travels()[id] : undefined;
  });

  getActivities(dayId: Date): Signal<Activity[]> {
    const key = dayId.toISOString();

    return computed(() => {
      const ids = this.dayActivities()[key] ?? [];
      const map = this.activities();
      return ids.map((id) => map[id]);
    });
  }

  getActivity(activityId: number) {
    return computed(() => this.activities()[activityId]);
  }

  // ✅ LOAD DATA FROM FIREBASE
  constructor() {
    effect(() => {
      const id = this.activeTravelId();
      if (!id) return;

      this.dataSource.getTravel$(id).subscribe((travel) => {
        this.hydrate(travel);
      });
    });
  }

  // ✅ HYDRATATION
  private hydrate(travel: Travel) {
    const newTravels = { ...this.travels() };
    const newDays: DayEntities = {};
    const newActivities: ActivityEntities = {};
    const newTravelDays: Record<number, string[]> = {};
    const newDayActivities: Record<string, number[]> = {};

    newTravels[travel.id] = { ...travel, days: [] };

    newTravelDays[travel.id] = [];

    const infoItems: Record<number, Item> = {};
    const travelInfoItems: Record<number, number[]> = {};

    travelInfoItems[travel.id] = [];

    for (const item of travel.info.items) {
      infoItems[item.id] = item;
      travelInfoItems[travel.id].push(item.id);
    }

    this.infoItems.set(infoItems);
    this.travelInfoItems.set(travelInfoItems);

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

    this.travels.set(newTravels);
    this.days.set(newDays);
    this.activities.set(newActivities);
    this.travelDays.set(newTravelDays);
    this.dayActivities.set(newDayActivities);
  }

  // ✅ COMMANDES (ACTIVITIES)

  createActivity(tripId: number, dayId: Date, activity: Activity) {
    const dayKey = dayId.toISOString();

    // ✅ add entity
    this.activities.update((a) => ({
      ...a,
      [activity.id]: activity,
    }));

    // ✅ add id to day
    this.dayActivities.update((d) => ({
      ...d,
      [dayKey]: [...(d[dayKey] ?? []), activity.id],
    }));

    this.syncDay(tripId, dayId);
  }

  updateActivity(tripId: number, dayId: Date, activity: Activity) {
    this.activities.update((a) => ({
      ...a,
      [activity.id]: activity,
    }));

    this.syncDay(tripId, dayId);
  }

  removeActivity(tripId: number, dayId: Date, activityId: number) {
    const dayKey = dayId.toISOString();

    this.activities.update((a) => {
      const copy = { ...a };
      delete copy[activityId];
      return copy;
    });

    this.dayActivities.update((d) => ({
      ...d,
      [dayKey]: (d[dayKey] ?? []).filter((id) => id !== activityId),
    }));

    this.syncDay(tripId, dayId);
  }

  reorderActivities(tripId: number, dayId: Date, ids: number[]) {
    const dayKey = dayId.toISOString();

    this.dayActivities.update((d) => ({
      ...d,
      [dayKey]: ids,
    }));

    this.syncDay(tripId, dayId);
  }

  // ✅ UTIL
  private syncDay(tripId: number, dayId: Date) {
    const dayKey = dayId.toISOString();
    const activityIds = this.dayActivities()[dayKey] ?? [];
    const activities = this.activities();

    const list = activityIds.map((id) => activities[id]);

    this.persistence.queueUpdate(tripId, dayId, list);
  }

  setActiveTravel(id: number) {
    this.activeTravelId.set(id);
  }

  getInfoItems(tripId: number) {
    return computed(() => {
      const ids = this.travelInfoItems()[tripId] ?? [];
      const map = this.infoItems();

      return ids.map((id) => map[id]);
    });
  }

  createItem(tripId: number, item: Item) {
    this.infoItems.update((items) => ({
      ...items,
      [item.id]: item,
    }));

    this.travelInfoItems.update((map) => ({
      ...map,
      [tripId]: [...(map[tripId] ?? []), item.id],
    }));

    this.syncInfo(tripId);
  }

  updateItem(tripId: number, itemId: number, patch: Partial<Item>) {
    const current = this.infoItems()[itemId];
    if (!current) return;

    this.infoItems.update((items) => ({
      ...items,
      [itemId]: { ...current, ...patch },
    }));

    this.syncInfo(tripId);
  }
  removeItem(tripId: number, itemId: number) {
    this.infoItems.update((items) => {
      const copy = { ...items };
      delete copy[itemId];
      return copy;
    });

    this.travelInfoItems.update((map) => ({
      ...map,
      [tripId]: (map[tripId] ?? []).filter((id) => id !== itemId),
    }));

    this.syncInfo(tripId);
  }
  reorderItems(tripId: number, ids: number[]) {
    this.travelInfoItems.update((map) => ({
      ...map,
      ids,
    }));

    this.syncInfo(tripId);
  }

  private syncInfo(tripId: number) {
    const ids = this.travelInfoItems()[tripId] ?? [];
    const items = this.infoItems();

    const list = ids.map((id) => items[id]);

    this.persistence.queueInfoUpdate(tripId, list);
  }
}
