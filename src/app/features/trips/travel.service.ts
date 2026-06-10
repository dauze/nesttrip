import { computed, effect, inject, Injectable, Signal, signal } from '@angular/core';
import { TravelDataSource } from '@app/core/infra/firebase/services/travel.persistence.service';
import { ActivityPersistenceService } from '@core/infra/firebase/services/activity.persistence.service';
import { Item } from './trip-detail/infos/info.models';
import { InfoPersistenceService } from '@app/core/infra/firebase/services/infos.persistence.service';
import { Subscription } from 'rxjs';
import { Travel, Day } from './travel.model';
import { Activity } from './trip-detail/day-panel/activity-card/activity.model';

type TravelEntities = Record<string, Travel>;
type DayEntities = Record<string, Day>;       // key = ISO date
type ActivityEntities = Record<string, Activity>;

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
  private readonly travelDays = signal<Record<string, string[]>>({});
  private readonly dayActivities = signal<Record<string, string[]>>({});
  private readonly infoItems = signal<Record<string, Item>>({});
  private readonly travelInfoItems = signal<Record<string, string[]>>({});

  // ✅ UI STATE — liste des trips (dashboard)
  readonly trips = signal<Pick<Travel, 'id' | 'title'>[]>([]);
  readonly tripsLoading = signal<boolean>(false);

  // ✅ UI STATE — trip actif
  private readonly activeTravelId = signal<string | null>(null);
  readonly activeTravelLoading = signal<boolean>(false);

  private tripsUnsub?: () => void;
  private travelSub: Subscription | null = null;

  // ✅ SELECTOR — trip actif reconstitué depuis l'état normalisé
  readonly activeTravel = computed(() => {
    const id = this.activeTravelId();
    if (!id) return null;

    const travel = this.travels()[id];
    if (!travel) return null;

    const dayKeys = this.travelDays()[id] ?? [];
    const daysMap = this.days();

    return {
      ...travel,
      days: dayKeys.map((key) => daysMap[key]),
    };
  });

  // ✅ SELECTOR — activités par jour (memoïsé)
  private readonly activitiesByDay = new Map<string, Signal<Activity[]>>();
  private readonly activitiesById = new Map<string, Signal<Activity>>();

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

  getActivity(activityId: string): Signal<Activity> {
    if (!this.activitiesById.has(activityId)) {
      this.activitiesById.set(
        activityId,
        computed(() => this.activities()[activityId]),
      );
    }
    return this.activitiesById.get(activityId)!;
  }

  // ✅ LOAD DATA FROM FIREBASE
  private hydrated = new Set<string>();

  constructor() {
    effect(() => {
      this.activeTravelLoading.set(true);
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
        this.activeTravelLoading.set(false);
      });
    });
  }

  private mergeFromRemote(travel: Travel) {
    const currentActivities = this.activities();

    const newActivities: ActivityEntities = {};
    const newDayActivities: Record<string, string[]> = {};

    for (const day of travel.days) {
      const dayKey = day.id.toISOString();
      newDayActivities[dayKey] = [];

      for (const activity of day.activities) {
        const current = currentActivities[activity.id];

        // ✅ Même référence si pas de changement → pas de re-render
        newActivities[activity.id] =
          current && JSON.stringify(current) === JSON.stringify(activity)
            ? current
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
    const newTravelDays: Record<string, string[]> = {};
    const newDayActivities: Record<string, string[]> = {};

    newTravels[travel.id] = { ...travel, days: [] };
    newTravelDays[travel.id] = [];

    const infoItems: Record<string, Item> = {};
    const travelInfoItems: Record<string, string[]> = {};
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

  // ✅ COMMANDES — TRIP

  /**
   * Charge la liste légère des trips (id + title).
   * Appelé au montage de TripListComponent.
   */
  loadTrips(): void {
    this.tripsLoading.set(true);
    this.tripsUnsub?.();

    const sub = this.dataSource.getTrips$().subscribe({
      next: (trips) => {
        this.trips.set(trips);
        this.tripsLoading.set(false);
      },
      error: () => this.tripsLoading.set(false),
    });

    this.tripsUnsub = () => sub.unsubscribe();
  }

  /**
   * Déclenche le chargement du trip complet via l'effect du constructor.
   * Appelé depuis TripDetailComponent via ActivatedRoute.
   */
  setActiveTrip(id: string): void {
    this.activeTravelId.set(id);
  }

  /**
   * Nettoyage du trip actif.
   */
  clearActiveTrip(): void {
    this.travelSub?.unsubscribe();
    this.activeTravelId.set(null);
  }

  // ✅ COMMANDES — ACTIVITIES

  createActivity(tripId: string, dayId: Date, activity: Activity) {
    const dayKey = dayId.toISOString();

    this.activities.update((a) => ({ ...a, [activity.id]: activity }));
    this.dayActivities.update((d) => ({
      ...d,
      [dayKey]: [...(d[dayKey] ?? []), activity.id],
    }));

    this.syncDay(tripId, dayId);
  }

  updateActivity(tripId: string, dayId: Date, activity: Activity) {
    this.activities.update((a) => ({ ...a, [activity.id]: activity }));
    this.syncDay(tripId, dayId);
  }

  removeActivity(tripId: string, dayId: Date, activityId: string) {
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

  reorderActivities(tripId: string, dayId: Date, ids: string[]) {
    const dayKey = dayId.toISOString();
    this.dayActivities.update((d) => ({ ...d, [dayKey]: ids }));
    this.syncDay(tripId, dayId);
  }

  private syncDay(tripId: string, dayId: Date) {
    const dayKey = dayId.toISOString();
    const activityIds = this.dayActivities()[dayKey] ?? [];
    const activitiesMap = this.activities();

    const list = activityIds.map((id) => activitiesMap[id]);
    this.activityPersistenceService.queueUpdate(tripId, dayId, list);
  }

  // ✅ COMMANDES — INFO ITEMS

  getInfoItems(tripId: string) {
    return computed(() => {
      const ids = this.travelInfoItems()[tripId] ?? [];
      const map = this.infoItems();
      return ids.map((id) => map[id]);
    });
  }

  createItem(tripId: string, item: Item) {
    this.infoItems.update((items) => ({ ...items, [item.id]: item }));
    this.travelInfoItems.update((map) => ({
      ...map,
      [tripId]: [...(map[tripId] ?? []), item.id],
    }));
    this.syncInfo(tripId);
  }

  updateItem(tripId: string, itemId: string, patch: Partial<Item>) {
    const current = this.infoItems()[itemId];
    if (!current) return;

    this.infoItems.update((items) => ({
      ...items,
      [itemId]: { ...current, ...patch },
    }));
    this.syncInfo(tripId);
  }

  removeItem(tripId: string, itemId: string) {
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

  reorderItems(tripId: string, ids: string[]) {
    this.travelInfoItems.update((map) => ({ ...map, [tripId]: ids }));
    this.syncInfo(tripId);
  }

  private syncInfo(tripId: string) {
    const ids = this.travelInfoItems()[tripId] ?? [];
    const items = this.infoItems();

    const list = ids.map((id) => items[id]);
    this.infoPersistenceService.queueUpdate(tripId, list);
  }
}