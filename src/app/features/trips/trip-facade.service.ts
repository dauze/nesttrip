import { inject, Injectable } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Day, Trip } from './trip.model';
import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { FlightLogistic, FlightStatus, Logistic } from '@core/models/logistic.dto';
import { TripStore } from './trip-store.service';
import { TripRepository } from '@app/core/infra/firebase/services/trip-repository';
import { Item } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';

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
    this.store.activeTripLoading.set(false);
    this.tripSub?.unsubscribe();
    this.tripSub = null;
    this.store._activeTripId.set(null);
  }

  addCollaborator(tripId: string, email: string): Observable<{ success: boolean; uid: string; email: string; displayName: string | null }> {
    return this.store.addCollaborator(tripId, email);
  }

  removeCollaborator(tripId: string, memberUid: string): Observable<{ success: boolean }> {
    return this.store.removeCollaborator(tripId, memberUid);
  }

  // ── Commandes ─────────────────────────────────────────────────────────────

  saveTrip(trip: Trip): void {
    this.store.saveTrip(trip);
  }

  updateTripTitle(trip: Trip): void {
    this.store.updateTripTitle(trip);
  }

  updateTripCurrency(tripId: string, currency: string): void {
    this.store.updateTripCurrency(tripId, currency);
  }

  removeTrip(tripId: string): void {
    this.store.removeTrip(tripId);
  }

  removeDay(tripId: string, dayId: Date): void {
    this.store.removeDay(tripId, dayId);
  }
  addDay(tripId: string, day: Day) {
     this.store.addDay(tripId, day);
  }

  /** Crée une activité de pool ET une instance pour ce jour en une fois (bouton "+" d'un jour). */
  createActivity(tripId: string, dayId: Date, poolActivity: PoolActivity, instance: DayActivityInstance): void {
    this.store.createActivity(tripId, dayId, poolActivity, instance);
  }

  /** Crée une activité directement dans le pool général du trip, sans jour associé. */
  createGeneralActivity(tripId: string, poolActivity: PoolActivity): void {
    this.store.createGeneralActivity(tripId, poolActivity);
  }

  /** Crée une nouvelle instance référençant une activité de pool existante et l'attache à ce jour, sans toucher au pool. */
  attachPoolActivityToDay(tripId: string, poolId: string, targetDayId: Date): void {
    this.store.attachPoolActivityToDay(tripId, poolId, targetDayId);
  }

  /** Déplace une instance existante d'un jour à l'autre (garde son form). */
  moveDayActivityInstance(tripId: string, instanceId: string, targetDayId: Date): void {
    this.store.moveDayActivityInstance(tripId, instanceId, targetDayId);
  }

  /** Met à jour l'identité/les fichiers d'une activité de pool : se répercute sur toutes ses instances. */
  updatePoolActivity(tripId: string, poolActivity: PoolActivity): void {
    this.store.updatePoolActivity(tripId, poolActivity);
  }

  /** Met à jour le form d'une instance jour donnée : n'affecte ni le pool, ni les autres instances. */
  updateDayActivityInstance(tripId: string, instance: DayActivityInstance): void {
    this.store.updateDayActivityInstance(tripId, instance);
  }

  /** Supprime une activité de pool et, en cascade, toutes ses instances. */
  removePoolActivity(tripId: string, poolId: string): void {
    this.store.removePoolActivity(tripId, poolId);
  }

  /** Supprime uniquement ce placement (cette instance) : le pool et ses autres instances restent intacts. */
  removeDayActivityInstance(tripId: string, instanceId: string, dayId: Date): void {
    this.store.removeDayActivityInstance(tripId, instanceId, dayId);
  }

  reorderActivities(tripId: string, dayId: Date, ids: string[]): void {
    this.store.reorderActivities(tripId, dayId, ids);
  }

  /** Point d'entrée du drag-and-drop : crée un placement (origin 'pool') ou déplace l'instance existante (origin 'day'). */
  dispatchActivity(tripId: string, activityId: string, origin: 'pool' | 'day', targetDayId: Date): void {
    this.store.dispatchActivity(tripId, activityId, origin, targetDayId);
  }

  createLogistic(tripId: string, logistic: Logistic): void {
    this.store.createLogistic(tripId, logistic);
  }

  updateLogistic(tripId: string, logistic: Logistic): void {
    this.store.updateLogistic(tripId, logistic);
  }

  removeLogistic(tripId: string, logisticId: string): void {
    this.store.removeLogistic(tripId, logisticId);
  }

  updateFlightStatus(tripId: string, logistic: FlightLogistic, status: FlightStatus, statusFetchedAt: Date): void {
    this.store.updateFlightStatus(tripId, logistic, status, statusFetchedAt);
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

  getDayActivities = this.store.getDayActivities.bind(this.store);
  getDayActivity = this.store.getDayActivity.bind(this.store);
  getPoolActivity = this.store.getPoolActivity.bind(this.store);
  getPoolActivityView = this.store.getPoolActivityView.bind(this.store);
  /** Toutes les activités de pool d'un trip (placées sur un/plusieurs jours, ou aucun). */
  getAllPoolActivities = this.store.getAllPoolActivities.bind(this.store);
  /** Map poolActivityId -> liste des placements (jour + instance) où elle est présente. */
  getActivityPlacements = this.store.getActivityPlacements.bind(this.store);
  getNotesItems = this.store.getNotesItems.bind(this.store);
  /** Devise par défaut du trip — signal dédié, indépendant de `activeTrip()` (voir TripStore._tripCurrency). */
  getTripCurrency = this.store.getTripCurrency.bind(this.store);
  // 1. Exposer le sélecteur et la commande
  getTripMembers = this.store.getTripMembers.bind(this.store);
  getLogistic = this.store.getLogistic.bind(this.store);
  /** Toutes les réservations d'un trip, sans tri (voir `allLogisticsSorted`/`logisticsForDay` pour des vues dérivées). */
  getAllLogistics = this.store.getAllLogistics.bind(this.store);

  /**
   * Réservations triées automatiquement pour la liste du sous-menu
   * Réservations : sans date d'abord (jamais préremplie à la création, voir
   * ROADMAP.md — visible immédiatement pour inciter à la compléter, plutôt
   * que mélangée ou perdue), puis en cours/futures (chronologique), puis
   * passées à la fin (chronologique aussi) — voir ROADMAP.md "Administratif".
   * Le glisser-déposer manuel a été retiré au profit de ce tri, recalculé à
   * chaque lecture (même limite qu'`ActivityGoogleInfoComponent.isOpenNow` :
   * ne "bascule" pas tout seul entre deux rendus si seul le temps a passé).
   */
  allLogisticsSorted(tripId: string): Logistic[] {
    const now = Date.now();
    const rank = (r: Logistic): 0 | 1 | 2 => {
      if (!r.startDateTime || !r.endDateTime) return 0;
      return r.endDateTime.getTime() < now ? 2 : 1;
    };

    return [...this.store.getAllLogistics(tripId)()].sort((a, b) => {
      const rankA = rank(a);
      const rankB = rank(b);
      if (rankA !== rankB) return rankA - rankB;
      if (rankA === 0) return 0;
      return a.startDateTime!.getTime() - b.startDateTime!.getTime();
    });
  }

  /** Réservations dont la plage `[startDateTime, endDateTime]` touche ce jour (même jour calendaire) — celles sans date n'en touchent aucun. */
  logisticsForDay(tripId: string, dayId: Date): Logistic[] {
    const dayStart = new Date(dayId);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return this.store.getAllLogistics(tripId)().filter(
      (r) => r.startDateTime && r.endDateTime && r.startDateTime < dayEnd && r.endDateTime >= dayStart,
    );
  }
  // ── Hydratation ───────────────────────────────────────────────────────────

  private hydrate(trip: Trip): void {
    const newTrips = { ...this.store._trips() };
    const newDays = { ...this.store._days() };
    const newPoolActivities = { ...this.store._poolActivities() };
    const newDayActivityInstances = { ...this.store._dayActivityInstances() };
    const newTripDays = { ...this.store._tripDays() };
    const newDayActivityIds = { ...this.store._dayActivityIds() };
    const newTripActivities = { ...this.store._tripActivities() };
    const newLogistics = { ...this.store._logistics() };
    const newTripLogistics = { ...this.store._tripLogistics() };
    const notesItems = { ...this.store._notesItems() };
    const tripNotesItems = { ...this.store._tripNotesItems() };
    const tripMembers = { ...this.store._tripMembers() };

    const previousDayKeys = newTripDays[trip.id] ?? [];
    for (const dayKey of previousDayKeys) {
      for (const instanceId of newDayActivityIds[dayKey] ?? []) {
        delete newDayActivityInstances[instanceId];
      }
      delete newDayActivityIds[dayKey];
      delete newDays[dayKey];
    }

    const previousActivityIds = newTripActivities[trip.id] ?? [];
    for (const activityId of previousActivityIds) {
      delete newPoolActivities[activityId];
    }

    const previousLogisticIds = newTripLogistics[trip.id] ?? [];
    for (const logisticId of previousLogisticIds) {
      delete newLogistics[logisticId];
    }

    const previousItemIds = tripNotesItems[trip.id] ?? [];
    for (const itemId of previousItemIds) {
      delete notesItems[itemId];
    }

    delete tripNotesItems[trip.id];
    delete newTripDays[trip.id];
    delete newTripActivities[trip.id];
    delete newTripLogistics[trip.id];
    delete tripMembers[trip.id];

    newTrips[trip.id] = { ...trip, days: [], activities: [], dayActivityInstances: [], logistics: [] };
    newTripDays[trip.id] = [];
    newTripActivities[trip.id] = [];
    newTripLogistics[trip.id] = [];
    tripNotesItems[trip.id] = [];

    for (const item of trip.notes.items) {
      notesItems[item.id] = item;
      tripNotesItems[trip.id].push(item.id);
    }

    // 1. Le pool d'activités du trip est la source de vérité pour l'identité.
    for (const activity of trip.activities) {
      newPoolActivities[activity.id] = activity;
      newTripActivities[trip.id].push(activity.id);
    }

    // Ordre de traversée quelconque : `getAllLogistics` n'est plus lue
    // directement par l'UI (voir `allLogisticsSorted`, qui retrie à
    // chaque lecture — plus de glisser-déposer manuel ni d'ordre à
    // persister séparément).
    for (const logistic of trip.logistics) {
      newLogistics[logistic.id] = logistic;
      newTripLogistics[trip.id].push(logistic.id);
    }

    // 2. Les instances (form) du trip.
    for (const instance of trip.dayActivityInstances) {
      newDayActivityInstances[instance.id] = instance;
    }

    // 3. Les jours ne stockent que des références vers ces instances.
    for (const day of trip.days) {
      const dayKey = day.id.toISOString();
      newDays[dayKey] = { ...day, activityIds: [] };
      newTripDays[trip.id].push(dayKey);
      newDayActivityIds[dayKey] = [...day.activityIds];
    }
    tripMembers[trip.id] = trip.members;

    this.store._trips.set(newTrips);
    this.store._days.set(newDays);
    this.store._poolActivities.set(newPoolActivities);
    this.store._dayActivityInstances.set(newDayActivityInstances);
    this.store._tripDays.set(newTripDays);
    this.store._dayActivityIds.set(newDayActivityIds);
    this.store._tripActivities.set(newTripActivities);
    this.store._logistics.set(newLogistics);
    this.store._tripLogistics.set(newTripLogistics);
    this.store._notesItems.set(notesItems);
    this.store._tripNotesItems.set(tripNotesItems);
    this.store._tripMembers.set(tripMembers);
  }

   private mergeFromRemote(trip: Trip): void {
    const pendingIds = this.store._pendingActivityIds();

    // 1. Pool d'activités : source de vérité unique pour l'identité/fichiers.
    const currentPoolActivities = this.store._poolActivities();
    const newPoolActivities = { ...currentPoolActivities };
    for (const activity of trip.activities) {
      // Une édition locale de cette activité n'a pas encore été confirmée
      // par Firestore (write debouncée en cours) : on ne laisse PAS ce
      // snapshot (potentiellement encore ancien côté serveur) écraser
      // l'état optimiste local, sinon l'UI "revient en arrière" pendant la
      // fenêtre de debounce à chaque édition.
      if (pendingIds.has(activity.id)) continue;

      const current = currentPoolActivities[activity.id];
      newPoolActivities[activity.id] =
        current && JSON.stringify(current) === JSON.stringify(activity)
          ? current
          : activity;
    }

    // Nettoyage des activités de pool supprimées côté distant
    const remotePoolIds = new Set(trip.activities.map((a) => a.id));
    for (const id of this.store._tripActivities()[trip.id] ?? []) {
      if (!remotePoolIds.has(id) && !pendingIds.has(id)) delete newPoolActivities[id];
    }

    // 2. Instances (form) : même logique anti-flicker, indépendante du pool.
    const currentInstances = this.store._dayActivityInstances();
    const newInstances = { ...currentInstances };
    for (const instance of trip.dayActivityInstances) {
      if (pendingIds.has(instance.id)) continue;

      const current = currentInstances[instance.id];
      newInstances[instance.id] =
        current && JSON.stringify(current) === JSON.stringify(instance)
          ? current
          : instance;
    }

    // Nettoyage des instances supprimées côté distant (id référencé par au
    // moins un jour local du trip, mais absent du snapshot distant).
    const remoteInstanceIds = new Set(trip.dayActivityInstances.map((i) => i.id));
    const localDayKeys = this.store._tripDays()[trip.id] ?? [];
    const localDayActivityIds = this.store._dayActivityIds();
    for (const dayKey of localDayKeys) {
      for (const id of localDayActivityIds[dayKey] ?? []) {
        if (!remoteInstanceIds.has(id) && !pendingIds.has(id)) delete newInstances[id];
      }
    }

    // 3. Références jour -> instances
    // Même logique anti-flicker que le pool/les instances ci-dessus, mais
    // absente jusqu'ici : `DayActivitiesPersistenceService` (écriture
    // debouncée, ~300ms) n'a pas forcément encore confirmé l'ajout local
    // d'une instance sur ce jour (`syncDayActivityIds`, déclenché par
    // `dispatchActivity`/`attachPoolActivityToDay`) qu'un snapshot distant
    // ENTRE-TEMPS (déclenché par n'importe quelle autre écriture du trip, ex.
    // la création de l'activité de pool elle-même) peut arriver et ne pas
    // encore la contenir — remplacer purement et simplement par
    // `day.activityIds` la faisait alors disparaître localement, laissant une
    // fenêtre où un second geste (ou le retour du snapshot suivant) pouvait
    // la faire réapparaître en double (voir ROADMAP.md, "l'activité est créée
    // en double sur ce jour"). On réinjecte donc les ids PENDING encore
    // absents du snapshot distant, à la suite de celui-ci — jamais de doublon
    // possible (un id déjà dans `day.activityIds` n'est jamais réinjecté), et
    // l'ajout ponctuel disparaît de lui-même dès que le snapshot suivant
    // confirme l'écriture (l'id devient alors partie de `day.activityIds`).
    const newDayActivityIds: Record<string, string[]> = {};
    const localDayActivityIdsBefore = this.store._dayActivityIds();
    for (const day of trip.days) {
      const dayKey = day.id.toISOString();
      const remoteIds = day.activityIds;
      const localIds = localDayActivityIdsBefore[dayKey] ?? [];
      const pendingLocalOnly = localIds.filter((id) => pendingIds.has(id) && !remoteIds.includes(id));
      newDayActivityIds[dayKey] = pendingLocalOnly.length ? [...remoteIds, ...pendingLocalOnly] : [...remoteIds];
    }

    this.store._poolActivities.set(newPoolActivities);
    this.store._dayActivityInstances.set(newInstances);
    this.store._dayActivityIds.set(newDayActivityIds);
    // Firestore ne garantit pas l'ordre des clés d'un champ map (`activities`) :
    // reconstruire l'ordre du pool à partir de `trip.activities` à chaque
    // snapshot ferait "sauter" les activités existantes dès qu'on en ajoute
    // une. On garde l'ordre local déjà connu et on se contente d'ajouter les
    // nouveaux ids à la fin / retirer ceux disparus côté distant.
    this.store._tripActivities.update((map) => {
      const previousOrder = map[trip.id] ?? [];
      const remoteIds = new Set(trip.activities.map((a) => a.id));
      const preserved = previousOrder.filter((id) => remoteIds.has(id) || pendingIds.has(id));
      const newIds = trip.activities.map((a) => a.id).filter((id) => !previousOrder.includes(id));
      return { ...map, [trip.id]: [...preserved, ...newIds] };
    });

    this.store._tripMembers.update((map) => {
      const current = map[trip.id] ?? {};
      if (JSON.stringify(current) === JSON.stringify(trip.members)) return map;
      return { ...map, [trip.id]: trip.members };
    });

    // 4. Réservations : même logique anti-flicker, writer débouncé indépendant.
    const pendingLogisticIds = this.store._pendingLogisticIds();
    const currentLogistics = this.store._logistics();
    const newLogistics = { ...currentLogistics };
    for (const logistic of trip.logistics) {
      if (pendingLogisticIds.has(logistic.id)) continue;

      const current = currentLogistics[logistic.id];
      newLogistics[logistic.id] =
        current && JSON.stringify(current) === JSON.stringify(logistic)
          ? current
          : logistic;
    }

    const remoteLogisticIds = new Set(trip.logistics.map((r) => r.id));
    for (const id of this.store._tripLogistics()[trip.id] ?? []) {
      if (!remoteLogisticIds.has(id) && !pendingLogisticIds.has(id)) delete newLogistics[id];
    }

    this.store._logistics.set(newLogistics);
    this.store._tripLogistics.update((map) => {
      const previousOrder = map[trip.id] ?? [];
      const preserved = previousOrder.filter((id) => remoteLogisticIds.has(id) || pendingLogisticIds.has(id));
      const newIds = trip.logistics.map((r) => r.id).filter((id) => !previousOrder.includes(id));
      return { ...map, [trip.id]: [...preserved, ...newIds] };
    });
  }
}
