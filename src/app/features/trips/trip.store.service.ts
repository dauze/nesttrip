import { computed, Injectable, Signal, signal } from '@angular/core';
import { inject } from '@angular/core';
import { ActivityPersistenceService } from '@core/infra/firebase/services/activity.persistence.service';
import { InfoPersistenceService } from '@app/core/infra/firebase/services/infos.persistence.service';
import { Travel, Day } from './travel.model';
import { Activity } from './trip-detail/day-panel/activity-card/activity.model';
import { Item } from './trip-detail/infos/info.models';

type TravelEntities = Record<string, Travel>;
type DayEntities = Record<string, Day>;
type ActivityEntities = Record<string, Activity>;

@Injectable({ providedIn: 'root' })
export class TripStore {
  private readonly activityPersistenceService = inject(ActivityPersistenceService); //TODO à voir pour déguager
  private readonly infoPersistenceService = inject(InfoPersistenceService); //TODO à voir pour déguager

  // ── État normalisé ────────────────────────────────────────────────────────

  /** @internal — écrit uniquement par TravelLoaderService */
  readonly _travels = signal<TravelEntities>({});
  /** @internal */
  readonly _days = signal<DayEntities>({});
  /** @internal */
  readonly _activities = signal<ActivityEntities>({});
  /** @internal */
  readonly _travelDays = signal<Record<string, string[]>>({});
  /** @internal */
  readonly _dayActivities = signal<Record<string, string[]>>({});
  /** @internal */
  readonly _infoItems = signal<Record<string, Item>>({});
  /** @internal */
  readonly _travelInfoItems = signal<Record<string, string[]>>({});
  /** @internal */
 readonly _tripsResult = signal<Pick<Travel, 'id' | 'title'>[] | undefined>(undefined);
  // ── UI state ──────────────────────────────────────────────────────────────
  readonly _activeTravelId = signal<string | null>(null);
  readonly activeTravelLoading = signal<boolean>(false);

  // ── Liste des trips (dashboard) ───────────────────────────────────────────
 
  readonly trips = computed(() => this._tripsResult() ?? []);
  readonly tripsLoading = computed(() => this._tripsResult() === undefined);    

  // ── Sélecteur — trip actif reconstitué ───────────────────────────────────

  readonly activeTravel = computed(() => {
    const id = this._activeTravelId();
    if (!id) return null;

    const travel = this._travels()[id];
    if (!travel) return null;

    const dayKeys = this._travelDays()[id] ?? [];
    const daysMap = this._days();

    return {
      ...travel,
      days: dayKeys.map((key) => daysMap[key]),
    };
  });

  setActiveTrip(id: string): void {
    this._activeTravelId.set(id);
  }

  clearActiveTrip(): void {
    this._activeTravelId.set(null);
  }

  // ── Sélecteurs memoïsés par entité ───────────────────────────────────────

  private readonly activitiesByDay = new Map<string, Signal<Activity[]>>();
  private readonly activitiesById = new Map<string, Signal<Activity>>();

  getActivities(dayId: Date): Signal<Activity[]> {
    const key = dayId.toISOString();
    if (!this.activitiesByDay.has(key)) {
      this.activitiesByDay.set(
        key,
        computed(() => {
          const ids = this._dayActivities()[key] ?? [];
          const map = this._activities();
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
        computed(() => this._activities()[activityId]),
      );
    }
    return this.activitiesById.get(activityId)!;
  }

  // ── Commandes — Activities ────────────────────────────────────────────────

  createActivity(tripId: string, dayId: Date, activity: Activity): void {
    const dayKey = dayId.toISOString();

    this._activities.update((a) => ({ ...a, [activity.id]: activity }));
    this._dayActivities.update((d) => ({
      ...d,
      [dayKey]: [...(d[dayKey] ?? []), activity.id],
    }));

    this.syncDay(tripId, dayId);
  }

  updateActivity(tripId: string, dayId: Date, activity: Activity): void {
    this._activities.update((a) => ({ ...a, [activity.id]: activity }));
    this.syncDay(tripId, dayId);
  }

  removeActivity(tripId: string, dayId: Date, activityId: string): void {
    const dayKey = dayId.toISOString();

    this._activities.update((a) => {
      const copy = { ...a };
      delete copy[activityId];
      return copy;
    });

    this._dayActivities.update((d) => ({
      ...d,
      [dayKey]: (d[dayKey] ?? []).filter((id) => id !== activityId),
    }));

    this.syncDay(tripId, dayId);
  }

  reorderActivities(tripId: string, dayId: Date, ids: string[]): void {
    const dayKey = dayId.toISOString();
    this._dayActivities.update((d) => ({ ...d, [dayKey]: ids }));
    this.syncDay(tripId, dayId);
  }

  private syncDay(tripId: string, dayId: Date): void {
    const dayKey = dayId.toISOString();
    const activityIds = this._dayActivities()[dayKey] ?? [];
    const activitiesMap = this._activities();

    const list = activityIds.map((id) => activitiesMap[id]);
    this.activityPersistenceService.queueUpdate(tripId, dayId, list);
  }

  // ── Commandes — Info items ────────────────────────────────────────────────

  getInfoItems(tripId: string): Signal<Item[]> {
    return computed(() => {
      const ids = this._travelInfoItems()[tripId] ?? [];
      const map = this._infoItems();
      return ids.map((id) => map[id]);
    });
  }

  createItem(tripId: string, item: Item): void {
    this._infoItems.update((items) => ({ ...items, [item.id]: item }));
    this._travelInfoItems.update((map) => ({
      ...map,
      [tripId]: [...(map[tripId] ?? []), item.id],
    }));
    this.syncInfo(tripId);
  }

  updateItem(tripId: string, itemId: string, patch: Partial<Item>): void {
    const current = this._infoItems()[itemId];
    if (!current) return;

    this._infoItems.update((items) => ({
      ...items,
      [itemId]: { ...current, ...patch },
    }));
    this.syncInfo(tripId);
  }

  removeItem(tripId: string, itemId: string): void {
    this._infoItems.update((items) => {
      const copy = { ...items };
      delete copy[itemId];
      return copy;
    });

    this._travelInfoItems.update((map) => ({
      ...map,
      [tripId]: (map[tripId] ?? []).filter((id) => id !== itemId),
    }));
    this.syncInfo(tripId);
  }

  reorderItems(tripId: string, ids: string[]): void {
    this._travelInfoItems.update((map) => ({ ...map, [tripId]: ids }));
    this.syncInfo(tripId);
  }

  private syncInfo(tripId: string): void {
    const ids = this._travelInfoItems()[tripId] ?? [];
    const items = this._infoItems();

    const list = ids.map((id) => items[id]);
    this.infoPersistenceService.queueUpdate(tripId, list);
  }
}