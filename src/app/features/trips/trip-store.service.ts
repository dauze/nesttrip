import { computed, effect, Injectable, Signal, signal } from '@angular/core';
import { inject } from '@angular/core';
import { Trip, Day, TripMember } from './trip.model';
import { Activity, PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { ActivityPersistenceService } from '@app/core/infra/firebase/services/persistence/activity-persistence.service';
import { DayActivityInstancePersistenceService } from '@app/core/infra/firebase/services/persistence/day-activity-instance-persistence.service';
import { DayActivitiesPersistenceService } from '@app/core/infra/firebase/services/persistence/day-activities-persistence.service';
import { TripPersistenceService } from '@app/core/infra/firebase/services/persistence/trip-persistence';
import { DayPersistenceService } from '@app/core/infra/firebase/services/persistence/day-persistence.service';
import { Item } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import { NotesPersistenceService } from '@app/core/infra/firebase/services/persistence/notes-persistence.service';
import { CollaborationService } from '@app/core/services/collaboration.service';
import { Observable, tap } from 'rxjs';

type TripEntities = Record<string, Trip>;
type DayEntities = Record<string, Day>;
type PoolActivityEntities = Record<string, PoolActivity>;
type DayActivityInstanceEntities = Record<string, DayActivityInstance>;
type MemberEntities = Record<string, Record<string, TripMember>>; // tripId -> Record<email, Member>

/** Form par défaut d'une nouvelle instance jour (activité neuve ou pool fraîchement dispatché). */
function defaultInstanceForm(): Omit<DayActivityInstance, 'id' | 'activityId'> {
  return {
    type: ActivityType.ACTIVITE,
    duration: 0,
    price: { amount: 0, currency: 'EUR' },
    booking: { status: BookingStatus.NOT_NEEDED },
    notes: '',
  };
}

@Injectable({ providedIn: 'root' })
export class TripStore {
  private readonly activityPersistenceService = inject(ActivityPersistenceService);
  private readonly dayActivityInstancePersistenceService = inject(DayActivityInstancePersistenceService);
  private readonly dayActivitiesPersistenceService = inject(DayActivitiesPersistenceService);
  private readonly notesPersistenceService = inject(NotesPersistenceService);
  private readonly tripPersistenceService = inject(TripPersistenceService);
  private readonly dayPersistenceService = inject(DayPersistenceService);
  private readonly collaborationService = inject(CollaborationService);

  constructor() {
    // Dès que les DEUX writers débouncés (pool + instances) n'ont plus rien
    // en cours (tout le lot en attente a été flush + confirmé par Firestore),
    // on relâche le verrou anti-écrasement : un futur snapshot distant peut
    // de nouveau mettre à jour ces activités/instances (édition par un
    // collaborateur, etc.). Les deux writers partagent le même
    // `_pendingActivityIds` (poolId ET instanceId) : attendre que les DEUX
    // soient idle évite de relâcher trop tôt la protection d'une instance
    // encore en cours d'écriture pendant que le pool, lui, est déjà à jour.
    effect(() => {
      if (!this.activityPersistenceService.syncing() && !this.dayActivityInstancePersistenceService.syncing()) {
        this._pendingActivityIds.set(new Set());
      }
    });
  }

  // ── État normalisé ────────────────────────────────────────────────────────

  /** @internal — écrit uniquement par TripLoaderService */
  readonly _trips = signal<TripEntities>({});
  /** @internal */
  readonly _days = signal<DayEntities>({});
  /** @internal — pool plat de TOUTES les activités (légères : identité + fichiers) connues, quel que soit le trip */
  readonly _poolActivities = signal<PoolActivityEntities>({});
  /** @internal — TOUTES les instances (form) connues, quel que soit le trip — une même activité de pool peut avoir plusieurs instances (une par jour où elle est placée) */
  readonly _dayActivityInstances = signal<DayActivityInstanceEntities>({});
  /** @internal */
  readonly _tripDays = signal<Record<string, string[]>>({});
  /** @internal — instance ids référencés par un jour donné, dans l'ordre */
  readonly _dayActivityIds = signal<Record<string, string[]>>({});
  /** @internal — TOUTES les activités de pool appartenant à un trip (placées sur un/plusieurs jours, ou aucun) */
  readonly _tripActivities = signal<Record<string, string[]>>({});
  /** @internal */
  readonly _tripMembers = signal<MemberEntities>({});
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
  private readonly membersByTrip = new Map<string, Signal<Record<string, TripMember>>>();
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
      // `trip.activities` mais via le sélecteur dédié `getAllPoolActivities(tripId)`.
      // Le lire ici rendrait `activeTrip` (et tout ce qui en dépend, dont le
      // skeleton de chargement) réactif à CHAQUE édition d'activité.
      activities: [],
      dayActivityInstances: [],
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

  /** Compose la vue `Activity` consommée par l'UI à partir d'une instance jour et de l'activité de pool qu'elle référence. */
  private composeInstanceView(instance: DayActivityInstance, pool: PoolActivity | undefined): Activity {
    return {
      id: instance.id,
      activityId: instance.activityId,
      title: pool?.title ?? '',
      files: pool?.files ?? [],
      placeId: pool?.placeId,
      address: pool?.address,
      latitude: pool?.latitude,
      longitude: pool?.longitude,
      photoRefs: pool?.photoRefs ?? [],
      type: instance.type,
      duration: instance.duration,
      startTime: instance.startTime,
      endTime: instance.endTime,
      price: instance.price,
      booking: instance.booking,
      notes: instance.notes,
    };
  }

  /** Compose la vue `Activity` "légère" d'une activité de pool (contexte général, sans instance/form). */
  private composePoolView(pool: PoolActivity): Activity {
    return {
      id: pool.id,
      activityId: pool.id,
      title: pool.title,
      files: pool.files,
      placeId: pool.placeId,
      address: pool.address,
      latitude: pool.latitude,
      longitude: pool.longitude,
      photoRefs: pool.photoRefs,
      ...defaultInstanceForm(),
    };
  }

  private readonly dayActivitiesByDay = new Map<string, Signal<Activity[]>>();
  private readonly dayActivityViewById = new Map<string, Signal<Activity>>();
  private readonly poolActivityById = new Map<string, Signal<PoolActivity>>();
  private readonly poolActivityViewById = new Map<string, Signal<Activity>>();
  private readonly allPoolActivitiesByTrip = new Map<string, Signal<PoolActivity[]>>();

  /** Les instances (form) rattachées à un jour, composées avec l'identité de leur activité de pool. */
  getDayActivities(dayId: Date): Signal<Activity[]> {
    const key = dayId.toISOString();
    if (!this.dayActivitiesByDay.has(key)) {
      this.dayActivitiesByDay.set(
        key,
        computed(() => {
          const ids = this._dayActivityIds()[key] ?? [];
          const instances = this._dayActivityInstances();
          const pools = this._poolActivities();
          return ids
            .map((id) => instances[id])
            .filter((i): i is DayActivityInstance => !!i)
            .map((i) => this.composeInstanceView(i, pools[i.activityId]));
        }),
      );
    }
    return this.dayActivitiesByDay.get(key)!;
  }

  /** Vue composée d'une instance jour donnée, par son instance id. */
  getDayActivity(instanceId: string): Signal<Activity> {
    if (!this.dayActivityViewById.has(instanceId)) {
      this.dayActivityViewById.set(
        instanceId,
        computed(() => {
          const instance = this._dayActivityInstances()[instanceId];
          return this.composeInstanceView(instance, this._poolActivities()[instance?.activityId]);
        }),
      );
    }
    return this.dayActivityViewById.get(instanceId)!;
  }

  getPoolActivity(poolId: string): Signal<PoolActivity> {
    if (!this.poolActivityById.has(poolId)) {
      this.poolActivityById.set(
        poolId,
        computed(() => this._poolActivities()[poolId]),
      );
    }
    return this.poolActivityById.get(poolId)!;
  }

  /** Vue composée "légère" d'une activité de pool, pour la carte en contexte général (pas de form). */
  getPoolActivityView(poolId: string): Signal<Activity> {
    if (!this.poolActivityViewById.has(poolId)) {
      this.poolActivityViewById.set(
        poolId,
        computed(() => {
          const pool = this._poolActivities()[poolId];
          return pool ? this.composePoolView(pool) : undefined as unknown as Activity;
        }),
      );
    }
    return this.poolActivityViewById.get(poolId)!;
  }

  /** Le pool complet des activités d'un trip : placées sur un/plusieurs jours, ou aucun. */
  getAllPoolActivities(tripId: string): Signal<PoolActivity[]> {
    if (!this.allPoolActivitiesByTrip.has(tripId)) {
      this.allPoolActivitiesByTrip.set(
        tripId,
        computed(() => {
          const ids = this._tripActivities()[tripId] ?? [];
          const map = this._poolActivities();
          return ids.map((id) => map[id]).filter((a): a is PoolActivity => !!a);
        }),
      );
    }
    return this.allPoolActivitiesByTrip.get(tripId)!;
  }

  private readonly activityDayIdsByTrip = new Map<string, Signal<Map<string, Date[]>>>();

  /**
   * Pour un trip donné : map poolActivityId -> liste des jours où elle est
   * placée (une activité de pool peut être placée sur plusieurs jours en
   * même temps, chacun via sa propre instance). Sert à savoir si une
   * activité de pool est "placée quelque part" (présence + longueur > 0) et,
   * si oui, sur quels jours.
   */
  getActivityDayIds(tripId: string): Signal<Map<string, Date[]>> {
    if (!this.activityDayIdsByTrip.has(tripId)) {
      this.activityDayIdsByTrip.set(
        tripId,
        computed(() => {
          const dayKeys = this._tripDays()[tripId] ?? [];
          const dayActivityIds = this._dayActivityIds();
          const instances = this._dayActivityInstances();
          const map = new Map<string, Date[]>();
          for (const dayKey of dayKeys) {
            for (const instanceId of dayActivityIds[dayKey] ?? []) {
              const poolId = instances[instanceId]?.activityId;
              if (!poolId) continue;
              map.set(poolId, [...(map.get(poolId) ?? []), new Date(dayKey)]);
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

     this._tripMembers.update((map) => ({ ...map, [trip.id]: trip.members }));

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

  getTripMembers(tripId: string): Signal<Record<string, TripMember>> {
    if (!this.membersByTrip.has(tripId)) {
      this.membersByTrip.set(
        tripId,
        computed(() => this._tripMembers()[tripId] ?? {})
      );
    }
    return this.membersByTrip.get(tripId)!;
  }

  // 5. Ajouter la commande addCollaborator (Mise à jour optimiste isolée)
  addCollaborator(tripId: string, email: string) : Observable<{success: boolean;}>{
    return this.collaborationService.addCollaborator(tripId, email).pipe(
      tap(() => {
        this._tripMembers.update((map) => {
          const currentMembers = map[tripId] ?? {};
          return {
            ...map,
            [tripId]: {
              ...currentMembers,
              [email]: { email, displayName: email.split('@')[0] } as TripMember
            }
          };
        });
      })
    );
  }

  // ── Commandes — Activities ────────────────────────────────────────────────

  /** Crée une activité de pool ET une instance pour ce jour en une fois (bouton "+" d'un jour). */
  createActivity(tripId: string, dayId: Date, poolActivity: PoolActivity, instance: DayActivityInstance): void {
    this.addPoolActivity(tripId, poolActivity);
    this.addDayActivityInstance(tripId, dayId, instance);
  }

  /** Crée une activité dans le pool général du trip uniquement (aucun jour) : elle sera affichée avec des contours en tiret tant qu'elle n'est placée sur aucun jour. */
  createGeneralActivity(tripId: string, poolActivity: PoolActivity): void {
    this.addPoolActivity(tripId, poolActivity);
  }

  private addPoolActivity(tripId: string, poolActivity: PoolActivity): void {
    this._poolActivities.update((a) => ({ ...a, [poolActivity.id]: poolActivity }));
    this._tripActivities.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).includes(poolActivity.id)
        ? t[tripId]
        : [...(t[tripId] ?? []), poolActivity.id],
    }));
    this.markActivityPending(poolActivity.id);
    this.activityPersistenceService.queueUpdate(tripId, poolActivity);
  }

  private addDayActivityInstance(tripId: string, dayId: Date, instance: DayActivityInstance): void {
    const dayKey = dayId.toISOString();

    this._dayActivityInstances.update((i) => ({ ...i, [instance.id]: instance }));
    this._dayActivityIds.update((d) => ({
      ...d,
      [dayKey]: [...(d[dayKey] ?? []), instance.id],
    }));
    this.markActivityPending(instance.id);

    this.dayActivityInstancePersistenceService.queueUpdate(tripId, instance);
    this.syncDayActivityIds(tripId, dayId);
  }

  /** Crée une nouvelle instance référençant une activité de pool existante et l'attache à ce jour (drop depuis le pool) : ne modifie jamais l'activité de pool elle-même. */
  attachPoolActivityToDay(tripId: string, poolId: string, targetDayId: Date): void {
    const instance: DayActivityInstance = {
      id: crypto.randomUUID(),
      activityId: poolId,
      ...defaultInstanceForm(),
    };
    this.addDayActivityInstance(tripId, targetDayId, instance);
  }

  /**
   * Déplace une instance existante d'un jour à l'autre (garde son form) — ne
   * crée jamais de nouvelle instance, ne touche jamais au pool. No-op si
   * elle est déjà sur le jour cible.
   */
  moveDayActivityInstance(tripId: string, instanceId: string, targetDayId: Date): void {
    const targetKey = targetDayId.toISOString();
    const dayKeys = this._tripDays()[tripId] ?? [];
    const dayActivityIds = this._dayActivityIds();

    let previousDayKey: string | null = null;
    for (const key of dayKeys) {
      if ((dayActivityIds[key] ?? []).includes(instanceId)) {
        previousDayKey = key;
        break;
      }
    }

    if (previousDayKey === targetKey) return;

    this._dayActivityIds.update((d) => {
      const copy = { ...d };
      if (previousDayKey) {
        copy[previousDayKey] = (copy[previousDayKey] ?? []).filter((id) => id !== instanceId);
      }
      copy[targetKey] = [...(copy[targetKey] ?? []), instanceId];
      return copy;
    });

    if (previousDayKey) {
      this.syncDayActivityIds(tripId, new Date(previousDayKey));
    }
    this.syncDayActivityIds(tripId, targetDayId);
  }

  /**
   * Point d'entrée unique du drag-and-drop (voir ActivityDayDispatchOverlayComponent) :
   * `origin === 'pool'` crée un nouveau placement (attach), `origin === 'day'`
   * déplace le placement existant — `activityId` vaut respectivement le poolId
   * ou l'instanceId selon l'origine (voir `ActivityCardComponent.buildDraggedInfo`).
   */
  dispatchActivity(tripId: string, activityId: string, origin: 'pool' | 'day', targetDayId: Date): void {
    if (origin === 'pool') {
      this.attachPoolActivityToDay(tripId, activityId, targetDayId);
    } else {
      this.moveDayActivityInstance(tripId, activityId, targetDayId);
    }
  }

  /** Met à jour l'identité/les fichiers d'une activité de pool : se répercute sur toutes ses instances (elles ne stockent que le form). */
  updatePoolActivity(tripId: string, poolActivity: PoolActivity): void {
    this._poolActivities.update((a) => ({ ...a, [poolActivity.id]: poolActivity }));
    this.markActivityPending(poolActivity.id);
    this.activityPersistenceService.queueUpdate(tripId, poolActivity);
  }

  /** Met à jour le form d'une instance jour donnée : n'affecte ni le pool, ni les autres instances de la même activité. */
  updateDayActivityInstance(tripId: string, instance: DayActivityInstance): void {
    this._dayActivityInstances.update((i) => ({ ...i, [instance.id]: instance }));
    this.markActivityPending(instance.id);
    this.dayActivityInstancePersistenceService.queueUpdate(tripId, instance);
  }

  private markActivityPending(id: string): void {
    this._pendingActivityIds.update((s) => {
      const copy = new Set(s);
      copy.add(id);
      return copy;
    });
  }

  /**
   * Supprime définitivement une activité de pool ET, en cascade, toutes ses
   * instances (sur tous les jours où elle est placée). À utiliser depuis la
   * carte en contexte pool.
   */
  removePoolActivity(tripId: string, poolId: string): void {
    const dayKeys = this._tripDays()[tripId] ?? [];
    const dayActivityIds = this._dayActivityIds();
    const instances = this._dayActivityInstances();

    const affectedDayKeys: string[] = [];
    const instanceIdsToRemove: string[] = [];
    for (const dayKey of dayKeys) {
      const ids = (dayActivityIds[dayKey] ?? []).filter((id) => instances[id]?.activityId === poolId);
      if (ids.length) {
        affectedDayKeys.push(dayKey);
        instanceIdsToRemove.push(...ids);
      }
    }

    this._poolActivities.update((a) => {
      const copy = { ...a };
      delete copy[poolId];
      return copy;
    });
    this._tripActivities.update((t) => ({
      ...t,
      [tripId]: (t[tripId] ?? []).filter((id) => id !== poolId),
    }));

    if (instanceIdsToRemove.length) {
      const toRemove = new Set(instanceIdsToRemove);
      this._dayActivityInstances.update((i) => {
        const copy = { ...i };
        for (const id of toRemove) delete copy[id];
        return copy;
      });
      this._dayActivityIds.update((d) => {
        const copy = { ...d };
        for (const dayKey of affectedDayKeys) {
          copy[dayKey] = (copy[dayKey] ?? []).filter((id) => !toRemove.has(id));
        }
        return copy;
      });
      for (const dayKey of affectedDayKeys) {
        this.syncDayActivityIds(tripId, new Date(dayKey));
      }
      for (const instanceId of instanceIdsToRemove) {
        this.dayActivityInstancePersistenceService.removeInstance(tripId, instanceId).catch((err) => {
          console.error('[TripStore] Erreur suppression instance Firestore :', err);
        });
      }
    }

    this.activityPersistenceService.removeActivity(tripId, poolId).catch((err) => {
      console.error('[TripStore] Erreur suppression activité Firestore :', err);
    });
  }

  /** Supprime uniquement ce placement (cette instance) : le pool et ses autres instances restent intacts. À utiliser depuis la carte en contexte jour. */
  removeDayActivityInstance(tripId: string, instanceId: string, dayId: Date): void {
    const dayKey = dayId.toISOString();

    this._dayActivityInstances.update((i) => {
      const copy = { ...i };
      delete copy[instanceId];
      return copy;
    });
    this._dayActivityIds.update((d) => ({
      ...d,
      [dayKey]: (d[dayKey] ?? []).filter((id) => id !== instanceId),
    }));
    this.syncDayActivityIds(tripId, dayId);

    this.dayActivityInstancePersistenceService.removeInstance(tripId, instanceId).catch((err) => {
      console.error('[TripStore] Erreur suppression instance Firestore :', err);
    });
  }

  reorderActivities(tripId: string, dayId: Date, ids: string[]): void {
    const dayKey = dayId.toISOString();
    this._dayActivityIds.update((d) => ({ ...d, [dayKey]: ids }));
    this.syncDayActivityIds(tripId, dayId);
  }

  private syncDayActivityIds(tripId: string, dayId: Date): void {
    const dayKey = dayId.toISOString();
    const activityIds = this._dayActivityIds()[dayKey] ?? [];
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

    // Les activités de POOL du jour supprimé restent dans le pool général du
    // trip (identité + fichiers, potentiellement encore placées sur d'autres
    // jours) : seules les INSTANCES de ce jour, elles, n'ont plus de sens
    // sans leur jour et sont supprimées en cascade.
    const instanceIds = this._dayActivityIds()[dayKey] ?? [];
    if (instanceIds.length) {
      const toRemove = new Set(instanceIds);
      this._dayActivityInstances.update(instances => {
        const copy = { ...instances };
        for (const id of toRemove) delete copy[id];
        return copy;
      });
      for (const instanceId of instanceIds) {
        this.dayActivityInstancePersistenceService.removeInstance(tripId, instanceId).catch(err => {
          console.error('[TripStore] Erreur suppression instance Firestore :', err);
        });
      }
    }

    this._dayActivityIds.update(dayActivityIds => {
      const copy = { ...dayActivityIds };
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

      this._dayActivityIds.update(dayActivityIds => ({
        ...dayActivityIds,
        [dayKey]: [],
      }));

      // Firestore
      this.dayPersistenceService.addDay(tripId, day)
        .catch((err) => {
          console.error('[TripStore] Erreur ajout day Firestore :', err);
        });
    }
}