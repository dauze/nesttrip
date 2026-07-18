import { computed, effect, Injectable, Signal, signal } from '@angular/core';
import { inject } from '@angular/core';
import { Trip, Day } from './trip.model';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { ActivityPersistenceService } from '@app/core/infra/firebase/services/persistence/activity-persistence.service';
import { DayActivitiesPersistenceService } from '@app/core/infra/firebase/services/persistence/day-activities-persistence.service';
import { TripPersistenceService } from '@app/core/infra/firebase/services/persistence/trip-persistence';
import { DayPersistenceService } from '@app/core/infra/firebase/services/persistence/day-persistence.service';
import { Item } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import { NotesPersistenceService } from '@app/core/infra/firebase/services/persistence/notes-persistence.service';

type TripEntities = Record<string, Trip>;
type DayEntities = Record<string, Day>;
type ActivityEntities = Record<string, Activity>;

@Injectable({ providedIn: 'root' })
export class TripStore {
  private readonly activityPersistenceService = inject(ActivityPersistenceService);
  private readonly dayActivitiesPersistenceService = inject(DayActivitiesPersistenceService);
  private readonly notesPersistenceService = inject(NotesPersistenceService);
  private readonly tripPersistenceService = inject(TripPersistenceService);
  private readonly dayPersistenceService = inject(DayPersistenceService);

  constructor() {
    // Dès que le writer débouncé des activités n'a plus rien en cours (tout
    // le lot en attente a été flush + confirmé par Firestore), on relâche le
    // verrou anti-écrasement : un futur snapshot distant peut de nouveau
    // mettre à jour ces activités (édition par un collaborateur, etc.).
    effect(() => {
      if (!this.activityPersistenceService.syncing()) {
        this._pendingActivityIds.set(new Set());
      }
    });
  }

  // ── État normalisé ────────────────────────────────────────────────────────

  /** @internal — écrit uniquement par TripLoaderService */
  readonly _trips = signal<TripEntities>({});
  /** @internal */
  readonly _days = signal<DayEntities>({});
  /** @internal — pool plat de TOUTES les activités connues, quel que soit le trip */
  readonly _activities = signal<ActivityEntities>({});
  /** @internal */
  readonly _tripDays = signal<Record<string, string[]>>({});
  /** @internal — activités référencées par un jour donné (sous-ensemble du pool) */
  readonly _dayActivities = signal<Record<string, string[]>>({});
  /** @internal — TOUTES les activités appartenant à un trip (dispatchées ou non) */
  readonly _tripActivities = signal<Record<string, string[]>>({});
  /**
   * @internal — ids d'activités dont l'édition locale n'a pas encore été
   * confirmée par Firestore (write debouncée pas encore flush + confirmée).
   * Tant qu'un id est dans ce set, un snapshot distant ne doit PAS écraser
   * sa valeur locale (sinon l'UI optimiste "revient en arrière" pendant la
   * fenêtre de debounce à chaque édition).
   */
  readonly _pendingActivityIds = signal<Set<string>>(new Set());
  /** @internal */
  readonly _notesItems = signal<Record<string, Item>>({});
  /** @internal */
  readonly _tripNotesItems = signal<Record<string, string[]>>({});
  /** @internal */
 readonly _tripsResult = signal<Pick<Trip, 'id' | 'title' | 'ownerId'>[] | undefined>(undefined);
  // ── UI state ──────────────────────────────────────────────────────────────
  readonly _activeTripId = signal<string | null>(null);
  readonly activeTripLoading = signal<boolean>(false);

  // ── Liste des trips (dashboard) ───────────────────────────────────────────
 
  readonly trips = computed(() => this._tripsResult() ?? []);
  readonly tripsLoading = computed(() => this._tripsResult() === undefined);    

  // ── Sélecteur — trip actif reconstitué ───────────────────────────────────
  readonly activeTrip = computed(() => {
    const id = this._activeTripId();
    if (!id) return null;

    const trip = this._trips()[id];
    if (!trip) return null;

    const dayKeys = this._tripDays()[id] ?? [];
    const daysMap = this._days();

    return {
      ...trip,
      days: dayKeys
        .map(key => daysMap[key])
        .filter((day): day is Day => !!day),
      // Placeholder non-réactif : le pool d'activités n'est pas consommé via
      // `trip.activities` mais via le sélecteur dédié `getAllActivities(tripId)`.
      // Le lire ici rendrait `activeTrip` (et tout ce qui en dépend, dont le
      // skeleton de chargement) réactif à CHAQUE édition d'activité.
      activities: [],
    };
  });

  setActiveTrip(id: string): void {
    this._activeTripId.set(id);
  }

  clearActiveTrip(): void {
    this._activeTripId.set(null);
  }

  hasTrip(id: string): boolean {
    return id in this._trips();
  }

  // ── Sélecteurs memorisés par entité ───────────────────────────────────────

  private readonly activitiesByDay = new Map<string, Signal<Activity[]>>();
  private readonly activitiesById = new Map<string, Signal<Activity>>();
  private readonly allActivitiesByTrip = new Map<string, Signal<Activity[]>>();

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

  /** Le pool complet des activités d'un trip : dispatchées dans un jour ou non. */
  getAllActivities(tripId: string): Signal<Activity[]> {
    if (!this.allActivitiesByTrip.has(tripId)) {
      this.allActivitiesByTrip.set(
        tripId,
        computed(() => {
          const ids = this._tripActivities()[tripId] ?? [];
          const map = this._activities();
          return ids.map((id) => map[id]).filter((a): a is Activity => !!a);
        }),
      );
    }
    return this.allActivitiesByTrip.get(tripId)!;
  }

  private readonly activityDayIdsByTrip = new Map<string, Signal<Map<string, Date>>>();

  /**
   * Pour un trip donné : map activityId -> dayId, uniquement pour les
   * activités actuellement rattachées à un jour. Sert à la fois à savoir
   * si une activité est "dispatchée" (présence dans la map) et, si oui,
   * dans quel jour.
   */
  getActivityDayIds(tripId: string): Signal<Map<string, Date>> {
    if (!this.activityDayIdsByTrip.has(tripId)) {
      this.activityDayIdsByTrip.set(
        tripId,
        computed(() => {
          const dayKeys = this._tripDays()[tripId] ?? [];
          const dayActivities = this._dayActivities();
          const map = new Map<string, Date>();
          for (const dayKey of dayKeys) {
            for (const activityId of dayActivities[dayKey] ?? []) {
              map.set(activityId, new Date(dayKey));
            }
          }
          return map;
        }),
      );
    }
    return this.activityDayIdsByTrip.get(tripId)!;
  }

  // ── Commandes — Trip ────────────────────────────────────────────────

  saveTrip(trip: Trip): void {
    // 1. Hydratation optimiste des signals locaux
    // _tripsResult : ajout dans la liste du dashboard
    this._tripsResult.update((list) => [
      ...(list ?? []),
      { id: trip.id, title: trip.title, ownerId: trip.ownerId },
    ]);

    // _trips : entité complète
    this._trips.update((trips) => ({ ...trips, [trip.id]: trip }));

    // _days + _tripDays : un entry par jour
    const dayKeys: string[] = [];
    this._days.update((days) => {
      const copy = { ...days };
      for (const day of trip.days) {
        const key = day.id.toISOString();
        copy[key] = day;
        dayKeys.push(key);
      }
      return copy;
    });
    this._tripDays.update((map) => ({ ...map, [trip.id]: dayKeys }));
    this._tripActivities.update((map) => ({ ...map, [trip.id]: [] }));

    // _notesItems + _tripNotesItems : items des notes (vides à la création)
    const itemIds = trip.notes.items.map((note) => note.id);
    this._notesItems.update((items) => {
      const copy = { ...items };
      for (const item of trip.notes.items) {
        copy[item.id] = item;
      }
      return copy;
    });
    this._tripNotesItems.update((map) => ({ ...map, [trip.id]: itemIds }));

    // 2. Persistance Firestore (fire & forget — pas de debounce sur une création)
    this.tripPersistenceService.createTrip(trip).catch((err) => {
      console.error('[TripStore] Erreur création trip Firestore :', err);
    });
  }

  updateTripTitle(trip: Trip): void {
    // 1. Hydratation optimiste locale
    this._trips.update((trips) => ({
      ...trips,
      [trip.id]: trip
    }));

    this._tripsResult.update((list) =>
      list?.map(item =>
        item.id === trip.id
          ? { ...item, title: trip.title }
          : item
      ) ?? []
    );

    // 2. Persistance Firestore
    this.tripPersistenceService.updateTripTitle(trip).catch((err) => {
      console.error('[TripStore] Erreur update trip Firestore :', err);
    });
  }

  removeTrip(tripId: string) {
    this.tripPersistenceService.removeTrip(tripId);
    this._trips.update((t) => {
      const copy = { ...t };
      delete copy[tripId];
      return copy;
    });
  }

  // ── Commandes — Activities ────────────────────────────────────────────────

  /** Crée une activité rattachée à un jour ; elle rejoint aussi automatiquement le pool général du trip. */
  createActivity(tripId: string, dayId: Date, activity: Activity): void {
    const dayKey = dayId.toISOString();

    this._activities.update((a) => ({ ...a, [activity.id]: activity }));
    this._dayActivities.update((d) => ({
      ...d,
      [dayKey]: [...(d[dayKey] ?? []), activity.id],
    }));
    this._tripActivities.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).includes(activity.id)
        ? t[tripId]
        : [...(t[tripId] ?? []), activity.id],
    }));
    this.markActivityPending(activity.id);

    this.activityPersistenceService.queueUpdate(tripId, activity);
    this.syncDayActivityIds(tripId, dayId);
  }

  /** Crée une activité dans le pool général du trip uniquement (aucun jour) : elle sera affichée avec des contours en tiret jusqu'à être dispatchée. */
  createGeneralActivity(tripId: string, activity: Activity): void {
    this._activities.update((a) => ({ ...a, [activity.id]: activity }));
    this._tripActivities.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).includes(activity.id)
        ? t[tripId]
        : [...(t[tripId] ?? []), activity.id],
    }));
    this.markActivityPending(activity.id);

    this.activityPersistenceService.queueUpdate(tripId, activity);
  }

  /**
   * Met à jour une activité, où qu'elle soit affichée (jour ou vue générale) :
   * comme il s'agit d'un pointeur unique vers le pool, la modification se
   * répercute automatiquement partout où elle est référencée.
   */
  updateActivity(tripId: string, activity: Activity): void {
    this._activities.update((a) => ({ ...a, [activity.id]: activity }));
    this.markActivityPending(activity.id);
    this.activityPersistenceService.queueUpdate(tripId, activity);
  }

  private markActivityPending(activityId: string): void {
    this._pendingActivityIds.update((s) => {
      const copy = new Set(s);
      copy.add(activityId);
      return copy;
    });
  }

  /**
   * Supprime définitivement une activité du trip (pool + jour éventuel).
   * `dayId` est optionnel : absent lorsque l'activité était uniquement
   * affichée dans la vue générale (jamais dispatchée dans un jour).
   */
  removeActivity(tripId: string, activityId: string, dayId?: Date): void {
    this._activities.update((a) => {
      const copy = { ...a };
      delete copy[activityId];
      return copy;
    });

    this._tripActivities.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).filter((id) => id !== activityId),
    }));

    if (dayId) {
      const dayKey = dayId.toISOString();
      this._dayActivities.update((d) => ({
        ...d,
        [dayKey]: (d[dayKey] ?? []).filter((id) => id !== activityId),
      }));
      this.syncDayActivityIds(tripId, dayId);
    }

    this.activityPersistenceService.removeActivity(tripId, activityId).catch((err) => {
      console.error('[TripStore] Erreur suppression activité Firestore :', err);
    });
  }

  reorderActivities(tripId: string, dayId: Date, ids: string[]): void {
    const dayKey = dayId.toISOString();
    this._dayActivities.update((d) => ({ ...d, [dayKey]: ids }));
    this.syncDayActivityIds(tripId, dayId);
  }

  private syncDayActivityIds(tripId: string, dayId: Date): void {
    const dayKey = dayId.toISOString();
    const activityIds = this._dayActivities()[dayKey] ?? [];
    this.dayActivitiesPersistenceService.queueUpdate(tripId, dayId, activityIds);
  }

  // ── Commandes — Notes items ────────────────────────────────────────────────

  getNotesItems(tripId: string): Signal<Item[]> {
    return computed(() => {
      const ids = this._tripNotesItems()[tripId] ?? [];
      const map = this._notesItems();
      return ids.map((id) => map[id]);
    });
  }

  createItem(tripId: string, item: Item): void {
    this._notesItems.update((items) => ({ ...items, [item.id]: item }));
    this._tripNotesItems.update((map) => ({
      ...map,
      [tripId]: [...(map[tripId] ?? []), item.id],
    }));
    this.syncNotes(tripId);
  }

  updateItem(tripId: string, itemId: string, patch: Partial<Item>): void {
    const current = this._notesItems()[itemId];
    if (!current) return;

    this._notesItems.update((items) => ({
      ...items,
      [itemId]: { ...current, ...patch },
    }));
    this.syncNotes(tripId);
  }

  removeItem(tripId: string, itemId: string): void {
    this._notesItems.update((items) => {
      const copy = { ...items };
      delete copy[itemId];
      return copy;
    });

    this._tripNotesItems.update((map) => ({
      ...map,
      [tripId]: (map[tripId] ?? []).filter((id) => id !== itemId),
    }));
    this.syncNotes(tripId);
  }

  reorderItems(tripId: string, ids: string[]): void {
    this._tripNotesItems.update((map) => ({ ...map, [tripId]: ids }));
    this.syncNotes(tripId);
  }

  private syncNotes(tripId: string): void {
    const ids = this._tripNotesItems()[tripId] ?? [];
    const items = this._notesItems();

    const list = ids.map((id) => items[id]);
    this.notesPersistenceService.queueUpdate(tripId, list);
  }
    // ── Commandes — Day ────────────────────────────────────────────────

  removeDay(tripId: string, dayId: Date): void {
    const dayKey = dayId.toISOString();

    // Les activités du jour supprimé restent dans le pool général du trip
    // (elles apparaîtront simplement comme non-dispatchées) : seule la
    // référence du jour vers elles disparaît.
    this._dayActivities.update(dayActivities => {
      const copy = { ...dayActivities };
      delete copy[dayKey];
      return copy;
    });

    this._days.update(days => {
      const copy = { ...days };
      delete copy[dayKey];
      return copy;
    });

    this._tripDays.update(trips => ({
      ...trips,
      [tripId]: (trips[tripId] ?? []).filter(id => id !== dayKey),
    }));

    this.dayPersistenceService.removeDay(tripId, dayId).catch(err => {
      console.error('[TripStore] Erreur suppression day Firestore :', err);
    });
  }

  addDay(tripId: string, day: Day): void {
      const dayKey = day.id.toISOString();

      // état local optimiste
      this._days.update(days => ({
        ...days,
        [dayKey]: day,
      }));

      // ajout de la référence dans le trip
      this._tripDays.update(trips => ({
        ...trips,
        [tripId]: [
          ...(trips[tripId] ?? []),
          dayKey,
        ],
      }));

      this._dayActivities.update(dayActivities => ({
        ...dayActivities,
        [dayKey]: [],
      }));

      // Firestore
      this.dayPersistenceService.addDay(tripId, day)
        .catch((err) => {
          console.error('[TripStore] Erreur ajout day Firestore :', err);
        });
    }
}