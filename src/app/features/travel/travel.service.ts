import { computed, effect, inject, Injectable, Signal, signal } from '@angular/core';
import { Day, Travel } from '@features/travel/travel.model';
import { Activity } from '@app/features/travel/day-panel/activity-card/activity.model';
import { TravelDataSource } from '@app/core/infra/firebase/services/travel.persistence.service';
import { ActivityPersistenceService } from '@core/infra/firebase/services/activity.persistence.service';
import { Item } from './infos/info.models';
import { InfoPersistenceService } from '@app/core/infra/firebase/services/infos.persistence.service';
import { Subscription } from 'rxjs';

type TravelEntities = Record<number, Travel>;
type DayEntities = Record<string, Day>; // key = ISO date
type ActivityEntities = Record<number, Activity>;

@Injectable({ providedIn: 'root' })
export class TravelStore {
  private readonly dataSource = inject(TravelDataSource);
  private readonly activityPersistenceService = inject(ActivityPersistenceService);
  private readonly infoPersistenceService = inject(InfoPersistenceService);

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

  private travelSub: Subscription | null = null;

  private readonly activitiesByDay = new Map<string, Signal<Activity[]>>();
private readonly activitiesById = new Map<number, Signal<Activity>>();

  // ✅ SELECTORS
 readonly activeTravel = computed(() => {
  const id = this.activeTravelId();
  if (!id) return undefined;

  const travel = this.travels()[id];
  if (!travel) return undefined;

  const dayKeys = this.travelDays()[id] ?? [];
  const daysMap = this.days();

  return {
    ...travel,
    days: dayKeys.map((key) => daysMap[key]),
  };
});

getActivities(dayId: Date): Signal<Activity[]> {
  const key = dayId.toISOString();
  if (!this.activitiesByDay.has(key)) {
    this.activitiesByDay.set(
      key,
      computed(() => {
        const ids = this.dayActivities()[key] ?? [];
        const map = this.activities();
        return ids.map((id) => map[id]);
      }),
    );
  }
  return this.activitiesByDay.get(key)!;
}

getActivity(activityId: number): Signal<Activity> {
  if (!this.activitiesById.has(activityId)) {
    this.activitiesById.set(
      activityId,
      computed(() => this.activities()[activityId]),
    );
  }
  return this.activitiesById.get(activityId)!;
}

  // ✅ LOAD DATA FROM FIREBASE
private hydrated = new Set<number>();

constructor() {
  effect(() => {
    const id = this.activeTravelId();

    this.travelSub?.unsubscribe();

    if (!id) return;

    this.travelSub = this.dataSource.getTravel$(id).subscribe((travel) => {
      if (!this.hydrated.has(travel.id)) {
        this.hydrate(travel);
        this.hydrated.add(travel.id);
      } else {
        this.mergeFromRemote(travel);
      }
    });
  });
}

private mergeFromRemote(travel: Travel) {
  const currentActivities = this.activities();

  const newActivities: ActivityEntities = {};
  const newDayActivities: Record<string, number[]> = {};

  for (const day of travel.days) {
    const dayKey = day.id.toISOString();
    newDayActivities[dayKey] = [];

    for (const activity of day.activities) {
      const current = currentActivities[activity.id];

      // ✅ On ne remplace que si l'activité a vraiment changé
      newActivities[activity.id] =
        current && JSON.stringify(current) === JSON.stringify(activity)
          ? current  // même référence → pas de re-render
          : activity;

      newDayActivities[dayKey].push(activity.id);
    }
  }

  this.activities.set(newActivities);
  this.dayActivities.set(newDayActivities);
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

  this.activityPersistenceService.queueUpdate(tripId, dayId, list);
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
      [tripId]: ids,
    }));

    this.syncInfo(tripId);
  }

private syncInfo(tripId: number) {
  const ids = this.travelInfoItems()[tripId] ?? [];
  const items = this.infoItems();

  const list = ids.map((id) => items[id]);

  this.infoPersistenceService.queueUpdate(tripId, list);
}
}
