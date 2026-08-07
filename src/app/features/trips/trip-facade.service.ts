import { inject, Injectable } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Day, Trip, TravelTiers } from './trip.model';
import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { FlightLogistic, FlightStatus, Logistic } from '@core/models/logistic.dto';
import { Expense } from '@core/models/expense.dto';
import { TripStore } from './trip-store.service';
import { TripRepository } from '@app/core/infra/firebase/services/trip-repository';
import { Item } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import { getLogisticDayOccurrences, LogisticDayOccurrence } from './trip-detail/trip-day-swiper/day-panel/day-logistic-banner/logistic-day-occurrence';
import { mergeDayTimeline, pinnedLogisticOccurrences, MergedDayEntry } from './trip-detail/trip-day-swiper/day-panel/day-logistic-banner/day-timeline-merge';
import { TravelMode } from './trip-detail/trip-day-swiper/day-panel/day-distance-gap/travel-mode.util';

/**
 * `true` si deux `Record<string, T>` ont exactement les mêmes clés, chacune
 * pointant vers la MÊME référence de valeur (`===`, pas une comparaison
 * profonde) — utilisé dans `TripFacade.mergeFromRemote` pour décider si un
 * signal a réellement besoin d'une nouvelle référence. Volontairement pas
 * une comparaison de contenu : les valeurs elles-mêmes sont déjà comparées/
 * préservées individuellement en amont (voir les boucles qui construisent
 * chaque `newXxx` ci-dessous) — ici on vérifie seulement qu'aucune de ces
 * références n'a effectivement bougé avant d'écrire dans le signal.
 */
function recordsShallowEqual<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

/** Même principe que `recordsShallowEqual`, pour un tableau ordonné (ex. `_tripActivities[tripId]`, `_dayActivityIds[dayKey]`) — comparaison par valeur (des ids, des primitives), position par position. */
function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}

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

  updateTripTitle(tripId: string, title: string): void {
    this.store.updateTripTitle(tripId, title);
  }

  updateTripTravelTiers(tripId: string, tiers: TravelTiers): void {
    this.store.updateTripTravelTiers(tripId, tiers);
  }

  setTravelModeOverride(tripId: string, placePairKey: string, mode: TravelMode | null): void {
    this.store.setTravelModeOverride(tripId, placePairKey, mode);
  }

  removeTrip(tripId: string): void {
    this.store.removeTrip(tripId);
  }

  /**
   * `true` dès que ce trip est hydraté dans le store (`loadTrip` a reçu au
   * moins un snapshot via `getTrip$`) — sert à `TripSummaryComponent` pour
   * savoir quand arrêter de préférer la valeur "rapide" issue de la liste
   * des trips (`trips()`, alimentée par une souscription Firestore SÉPARÉE
   * et non protégée par `_pendingTripFieldIds`/`_pendingTripDayIds`, voir
   * leur doc) au profit du signal dédié protégé (`getTripTitle`/
   * `getTripDateRange`) une fois ce dernier réellement disponible.
   */
  hasTrip(tripId: string): boolean {
    return this.store.hasTrip(tripId);
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

  /** Crée une nouvelle instance référençant une activité de pool existante et l'attache à ce jour, sans toucher au pool. Retourne l'id de l'instance créée. */
  attachPoolActivityToDay(tripId: string, poolId: string, targetDayId: Date): string {
    return this.store.attachPoolActivityToDay(tripId, poolId, targetDayId);
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

  /** Point d'entrée du drag-and-drop : crée un placement (origin 'pool') ou déplace l'instance existante (origin 'day'). Retourne l'id de l'instance déposée. */
  dispatchActivity(tripId: string, activityId: string, origin: 'pool' | 'day', targetDayId: Date): string {
    return this.store.dispatchActivity(tripId, activityId, origin, targetDayId);
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

  createExpense(tripId: string, expense: Expense): void {
    this.store.createExpense(tripId, expense);
  }

  updateExpense(tripId: string, expense: Expense): void {
    this.store.updateExpense(tripId, expense);
  }

  removeExpense(tripId: string, expenseId: string): void {
    this.store.removeExpense(tripId, expenseId);
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
  getDayActivitiesWithEchoes = this.store.getDayActivitiesWithEchoes.bind(this.store);
  getDayActivity = this.store.getDayActivity.bind(this.store);
  getDayActivityWithDay = this.store.getDayActivityWithDay.bind(this.store);
  getPoolActivity = this.store.getPoolActivity.bind(this.store);
  getPoolActivityView = this.store.getPoolActivityView.bind(this.store);
  /** Toutes les activités de pool d'un trip (placées sur un/plusieurs jours, ou aucun). */
  getAllPoolActivities = this.store.getAllPoolActivities.bind(this.store);
  /** Map poolActivityId -> liste des placements (jour + instance) où elle est présente. */
  getActivityPlacements = this.store.getActivityPlacements.bind(this.store);
  getNotesItems = this.store.getNotesItems.bind(this.store);
  getLinkedNoteItems = this.store.getLinkedNoteItems.bind(this.store);
  /** Paliers de mode de trajet du trip — signal dédié, indépendant de `activeTrip()` (voir TripStore._tripTravelTiers). */
  getTripTravelTiers = this.store.getTripTravelTiers.bind(this.store);
  /** Overrides manuels de mode de trajet du trip (clé = paire de lieux) — signal dédié, indépendant de `activeTrip()` (voir TripStore._tripTravelModeOverrides). */
  getTravelModeOverrides = this.store.getTravelModeOverrides.bind(this.store);
  /** Titre du trip — signal dédié, indépendant de `activeTrip()` (voir TripStore._tripTitle). */
  getTripTitle = this.store.getTripTitle.bind(this.store);
  /** Plage de dates (1er jour, dernier jour) du trip — signal dédié, indépendant de `activeTrip()` (voir TripStore.getTripDateRange). */
  getTripDateRange = this.store.getTripDateRange.bind(this.store);
  // 1. Exposer le sélecteur et la commande
  getTripMembers = this.store.getTripMembers.bind(this.store);
  getLogistic = this.store.getLogistic.bind(this.store);
  /** Toutes les réservations d'un trip, sans tri (voir `allLogisticsSorted`/`logisticsForDay` pour des vues dérivées). */
  getAllLogistics = this.store.getAllLogistics.bind(this.store);
  getExpense = this.store.getExpense.bind(this.store);
  /** Toutes les dépenses libres d'un trip (voir src/specs/devise.md 3.4). */
  getAllExpenses = this.store.getAllExpenses.bind(this.store);

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

  /**
   * Timeline fusionnée d'un jour (activités + échos + occurrences logistiques
   * "frontière"), triée chronologiquement — voir `mergeDayTimeline`
   * (ROADMAP.md "Activités"). Vit en Facade, pas en Store : composition de
   * deux sélecteurs déjà mémoïsés (`getDayActivitiesWithEchoes`,
   * `logisticsForDay`), pas de nouvel état ; `getLogisticDayOccurrences` est
   * un util d'affichage `day-panel`, pas un concept de domaine `TripStore`.
   */
  getMergedDayTimeline(tripId: string, dayId: Date): MergedDayEntry[] {
    const entries = this.store.getDayActivitiesWithEchoes(tripId, dayId)();
    const occurrences = this.logisticsForDay(tripId, dayId).flatMap((r) => getLogisticDayOccurrences(r, dayId));
    return mergeDayTimeline(entries, occurrences);
  }

  /** Occurrences épinglées en haut du jour (Nuit sur place / En cours) — alimente `DayLogisticBannerComponent`, inchangé pour ces 2 rôles uniquement. */
  getPinnedLogisticOccurrences(tripId: string, dayId: Date): LogisticDayOccurrence[] {
    const occurrences = this.logisticsForDay(tripId, dayId).flatMap((r) => getLogisticDayOccurrences(r, dayId));
    return pinnedLogisticOccurrences(occurrences);
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
    const newExpenses = { ...this.store._expenses() };
    const newTripExpenses = { ...this.store._tripExpenses() };
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

    const previousExpenseIds = newTripExpenses[trip.id] ?? [];
    for (const expenseId of previousExpenseIds) {
      delete newExpenses[expenseId];
    }

    const previousItemIds = tripNotesItems[trip.id] ?? [];
    for (const itemId of previousItemIds) {
      delete notesItems[itemId];
    }

    delete tripNotesItems[trip.id];
    delete newTripDays[trip.id];
    delete newTripActivities[trip.id];
    delete newTripLogistics[trip.id];
    delete newTripExpenses[trip.id];
    delete tripMembers[trip.id];

    newTrips[trip.id] = { ...trip, days: [], activities: [], dayActivityInstances: [], logistics: [], expenses: [] };
    newTripDays[trip.id] = [];
    newTripActivities[trip.id] = [];
    newTripLogistics[trip.id] = [];
    newTripExpenses[trip.id] = [];
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

    for (const expense of trip.expenses) {
      newExpenses[expense.id] = expense;
      newTripExpenses[trip.id].push(expense.id);
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
    this.store._expenses.set(newExpenses);
    this.store._tripExpenses.set(newTripExpenses);
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

    // 3. Ensemble des clés de jour du trip côté distant, calculé UNE fois et
    // réutilisé ci-dessous par `_dayActivityIds` ET `_days`/`_tripDays`.
    // `isTripDayPending` (voir `_pendingTripDayIds`) : au moins un
    // `addDay`/`removeDay` est encore en vol pour CE trip — modifier
    // l'intervalle de dates déclenche PLUSIEURS écritures ponctuelles d'un
    // coup, chacune confirmée séparément ; sans cette protection, un
    // snapshot intermédiaire (ne reflétant qu'UNE PARTIE des jours déjà
    // écrits côté serveur) semblait "différent" de l'état local optimiste
    // (qui, lui, a déjà TOUS les jours) à CHAQUE écriture individuelle
    // confirmée — régression confirmée par retour utilisateur ("la
    // modification des dates lance toujours le rechargement").
    const isTripDayPending = this.store._pendingTripDayIds().has(trip.id);
    const previousTripDayKeys = this.store._tripDays()[trip.id] ?? [];
    const previousTripDayKeySet = new Set(previousTripDayKeys);
    const remoteDayKeysList = trip.days.map((d) => d.id.toISOString());
    const remoteDayKeySet = new Set(remoteDayKeysList);

    // 3bis. Références jour -> instances (`_dayActivityIds`, flat, TOUS les
    // trips confondus — voir CLAUDE.md "état normalisé").
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
    //
    // CRITIQUE pour la stabilité de référence (voir la doc de
    // `recordsShallowEqual`) : deux pièges corrigés ici, tous deux réels dans
    // le code avant ce correctif (ROADMAP.md "Bugs / fixes", régression
    // confirmée par retour utilisateur — "tout se réactualise à chaque
    // édition de champ"). 1) `newDayActivityIds` était reconstruit à partir
    // des SEULS jours de `trip.days`, perdant les entrées des jours des
    // AUTRES trips déjà chargés dans cette session (`_dayActivityIds` est un
    // pool plat, pas scopé par trip) — corrigé en partant d'une copie
    // complète de la map existante. 2) chaque `newDayActivityIds[dayKey]`
    // était systématiquement une NOUVELLE référence de tableau (spread), même
    // quand son contenu était strictement identique à celui déjà en place —
    // `getDayActivities(dayId)` (TripStore) lit `_dayActivityIds()` dans son
    // `computed()` et reconstruit un NOUVEAU tableau d'`Activity` à chaque
    // exécution (jamais stable par identité même à contenu égal) : la moindre
    // nouvelle référence ici faisait donc réexécuter ET republier ce
    // `computed()` pour TOUS LES JOURS du trip (pas seulement celui
    // réellement modifié) à chaque confirmation Firestore d'une frappe
    // débattue sur N'IMPORTE QUELLE activité — d'où "toute la page" qui se
    // réactualisait. Corrigé en réutilisant la référence existante quand le
    // contenu calculé lui est identique (`arraysEqual`).
    const localDayActivityIdsBefore = this.store._dayActivityIds();
    const newDayActivityIds: Record<string, string[]> = { ...localDayActivityIdsBefore };
    for (const day of trip.days) {
      const dayKey = day.id.toISOString();
      const remoteIds = day.activityIds;
      const existing = localDayActivityIdsBefore[dayKey];
      const localIds = existing ?? [];
      const pendingLocalOnly = localIds.filter((id) => pendingIds.has(id) && !remoteIds.includes(id));
      const computed = pendingLocalOnly.length ? [...remoteIds, ...pendingLocalOnly] : remoteIds;
      newDayActivityIds[dayKey] = existing && arraysEqual(existing, computed) ? existing : computed;
    }
    // Jour retiré CÔTÉ DE CE TRIP (toujours connu avant, plus dans le
    // snapshot distant) : ses instances n'ont plus de jour, l'entrée n'a plus
    // de sens — jamais touché pour les jours des AUTRES trips (hors
    // `previousTripDayKeySet`, qui ne scope que CE trip). Sauté tant qu'un
    // `addDay`/`removeDay` est en vol (`isTripDayPending`) : un jour tout
    // juste ajouté localement mais pas encore confirmé par ce snapshot
    // serait sinon supprimé ici à tort (il n'est "connu avant" que
    // localement, `remoteDayKeySet` ne l'a pas encore).
    if (!isTripDayPending) {
      for (const dayKey of previousTripDayKeys) {
        if (!remoteDayKeySet.has(dayKey)) delete newDayActivityIds[dayKey];
      }
    }

    // 3ter. `_days`/`_tripDays` : jamais mis à jour ici jusqu'ici (seul
    // `hydrate()`, au tout premier chargement, les écrivait) — un jour
    // ajouté/supprimé par un autre collaborateur pendant que ce trip est déjà
    // ouvert ne se répercutait donc jamais localement (ROADMAP.md "Bugs /
    // fixes", "les dates de début et de fin... ne sont pas rafraîchies en
    // dynamique"). CONDITIONNEL, comparé à l'ensemble des clés déjà connues :
    // `activeTrip` recompose `Trip` depuis `_trips`+`_tripDays`+`_days` (voir
    // CLAUDE.md) — écrire une NOUVELLE référence à CHAQUE snapshot distant
    // casserait la même stabilité de référence que ci-dessus.
    // `addDay`/`removeDay` sont des écritures ponctuelles non debouncées (pas
    // de `DebounceWriter`), donc pas besoin du même mécanisme anti-flicker à
    // base de `pendingIds` que les entités qui, elles, passent par un writer
    // débouncé — seulement de ne toucher le signal QUE si l'ensemble des
    // jours a réellement changé (`previousTripDayKeySet`/`remoteDayKeySet`,
    // calculés en 3bis ci-dessus).
    const daysChanged =
      !isTripDayPending &&
      (previousTripDayKeySet.size !== remoteDayKeySet.size ||
        remoteDayKeysList.some((key) => !previousTripDayKeySet.has(key)));

    if (daysChanged) {
      const currentDays = this.store._days();
      const newDays = { ...currentDays };
      for (const dayKey of previousTripDayKeys) {
        if (!remoteDayKeySet.has(dayKey)) delete newDays[dayKey];
      }
      for (const day of trip.days) {
        // Ne remplace que les jours réellement NOUVEAUX : un jour déjà connu
        // n'a rien de plus à porter ici (`activityIds` toujours vidé dans ce
        // map, voir `hydrate()`) — préserve sa référence pour les jours
        // inchangés plutôt que de la recréer sans raison.
        const key = day.id.toISOString();
        if (!newDays[key]) newDays[key] = { ...day, activityIds: [] };
      }
      this.store._days.set(newDays);
      this.store._tripDays.update((map) => ({ ...map, [trip.id]: remoteDayKeysList }));
    }

    // 3quater. Champs primitifs du trip (titre/ville/lieu/propriétaire).
    //
    // `_tripTitle` (signal dédié, voir sa doc dans
    // TripStore) shadowe une édition locale en cours — mais tant que rien
    // ne protège `trip.id` pendant l'écriture Firestore en vol
    // (`_pendingTripFieldIds`, voir sa doc), le snapshot de CONFIRMATION qui
    // suit systématiquement CETTE écriture comparait `trip.title` (déjà
    // confirmé) à l'ANCIEN `_trips[trip.id].title` (jamais mis à jour par
    // `updateTripTitle`, exprès) : TOUJOURS "différent", donc `_trips`
    // réécrit à CHAQUE frappe débattue sur le titre, même sans aucun
    // changement réel — régression confirmée par retour utilisateur ("toute
    // la page se réactualise" à l'édition du titre/des dates). Corrigé en
    // ignorant tout le bloc tant que `trip.id` est pending (même principe que
    // `pendingIds` pour les activités), ET en comparant, une fois cette
    // protection levée, contre la valeur EFFECTIVE courante
    // (`_tripTitle[trip.id] ?? _trips[trip.id].title`) plutôt que contre
    // `_trips[trip.id].title` seul : si elle égale déjà la valeur distante
    // (mon écriture vient d'être confirmée), rien à faire. Si elle diffère
    // (un AUTRE collaborateur a renommé depuis), `_trips` est mis à jour ET
    // le shadow est effacé — sans ce dernier point, un renommage distant
    // ultérieur par quelqu'un d'autre restait indéfiniment masqué par mon
    // propre renommage passé (voir ROADMAP.md, "si quelqu'un le met à jour
    // en distant, ce n'est pas mis à jour en temps réel").
    const isTripFieldPending = this.store._pendingTripFieldIds().has(trip.id);
    const currentTrip = this.store._trips()[trip.id];
    const currentTripTitleShadow = this.store._tripTitle()[trip.id];
    const currentTripTiersShadow = this.store._tripTravelTiers()[trip.id];
    const currentTripModeOverridesShadow = this.store._tripTravelModeOverrides()[trip.id];

    let primitivesChanged = false;
    let titleShadowChanged = false;
    let tiersShadowChanged = false;
    let modeOverridesShadowChanged = false;

    if (!isTripFieldPending && currentTrip) {
      const effectiveTitle = currentTripTitleShadow ?? currentTrip.title;
      const effectiveTiers = currentTripTiersShadow ?? currentTrip.travelTiers;
      const effectiveModeOverrides = currentTripModeOverridesShadow ?? currentTrip.travelModeOverrides;
      const titleReallyChanged = effectiveTitle !== trip.title;
      // Objet (pas primitif) : comparaison structurelle, comme `structurallyEqual` côté TripStore.
      const tiersReallyChanged = JSON.stringify(effectiveTiers) !== JSON.stringify(trip.travelTiers);
      const modeOverridesReallyChanged = JSON.stringify(effectiveModeOverrides) !== JSON.stringify(trip.travelModeOverrides);

      primitivesChanged =
        titleReallyChanged ||
        tiersReallyChanged ||
        modeOverridesReallyChanged ||
        currentTrip.ville !== trip.ville ||
        currentTrip.ownerId !== trip.ownerId ||
        currentTrip.placeId !== trip.placeId;

      titleShadowChanged = titleReallyChanged && currentTripTitleShadow !== undefined;
      tiersShadowChanged = tiersReallyChanged && currentTripTiersShadow !== undefined;
      modeOverridesShadowChanged = modeOverridesReallyChanged && currentTripModeOverridesShadow !== undefined;
    }

    // À PARTIR D'ICI : chaque écriture de signal est CONDITIONNELLE, comparée
    // à l'état actuel (`recordsShallowEqual`/`arraysEqual`, voir leur doc en
    // tête de fichier) — pas seulement pour `_trips`/`_days`/`_tripDays` (voir
    // 3bis/3ter ci-dessus) mais pour TOUS les signaux touchés par cette
    // méthode (`_poolActivities`, `_dayActivityInstances`, `_dayActivityIds`,
    // `_tripActivities`, `_logistics`, `_tripLogistics`) : chacun était
    // jusqu'ici réécrit avec une NOUVELLE référence à CHAQUE snapshot distant,
    // MÊME quand toutes ses valeurs internes étaient déjà préservées par
    // référence (les boucles ci-dessus le font déjà bien) — le problème est
    // uniquement l'objet/tableau CONTENEUR, toujours neuf. Des sélecteurs
    // dérivés comme `TripStore.getDayActivities(dayId)` reconstruisent un
    // NOUVEAU tableau d'`Activity` à chaque exécution de leur `computed()`
    // (jamais stables par identité même à contenu strictement égal), et ce
    // `computed()` dépend de la RÉFÉRENCE de `_dayActivityIds()` (entre
    // autres) : la moindre nouvelle référence container, même vide de tout
    // changement réel, le faisait donc réexécuter ET republier pour TOUS LES
    // JOURS du trip à la moindre confirmation Firestore d'UNE SEULE activité
    // éditée — d'où "toute la page" qui se réactualisait à chaque champ
    // modifié (régression confirmée par retour utilisateur).
    if (!recordsShallowEqual(currentPoolActivities, newPoolActivities)) {
      this.store._poolActivities.set(newPoolActivities);
    }
    if (!recordsShallowEqual(currentInstances, newInstances)) {
      this.store._dayActivityInstances.set(newInstances);
    }
    if (!recordsShallowEqual(localDayActivityIdsBefore, newDayActivityIds)) {
      this.store._dayActivityIds.set(newDayActivityIds);
    }
    if (primitivesChanged) {
      this.store._trips.update((map) => ({
        ...map,
        [trip.id]: {
          ...currentTrip,
          title: trip.title,
          ville: trip.ville,
          ownerId: trip.ownerId,
          placeId: trip.placeId,
          travelTiers: trip.travelTiers,
          travelModeOverrides: trip.travelModeOverrides,
        },
      }));
    }
    // Un AUTRE collaborateur a changé le titre/les paliers de trajet depuis
    // mon dernier changement local confirmé (voir la doc du bloc 3quater
    // ci-dessus) : efface le shadow pour que
    // `getTripTitle`/`getTripTravelTiers` retombent sur `_trips[trip.id]`
    // (qui vient d'être mis à jour juste au-dessus) — sinon ce changement
    // distant resterait masqué indéfiniment.
    if (titleShadowChanged) {
      this.store._tripTitle.update((map) => {
        const copy = { ...map };
        delete copy[trip.id];
        return copy;
      });
    }
    if (tiersShadowChanged) {
      this.store._tripTravelTiers.update((map) => {
        const copy = { ...map };
        delete copy[trip.id];
        return copy;
      });
    }
    if (modeOverridesShadowChanged) {
      this.store._tripTravelModeOverrides.update((map) => {
        const copy = { ...map };
        delete copy[trip.id];
        return copy;
      });
    }
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
      const nextOrder = [...preserved, ...newIds];
      return arraysEqual(previousOrder, nextOrder) ? map : { ...map, [trip.id]: nextOrder };
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

    if (!recordsShallowEqual(currentLogistics, newLogistics)) {
      this.store._logistics.set(newLogistics);
    }
    this.store._tripLogistics.update((map) => {
      const previousOrder = map[trip.id] ?? [];
      const preserved = previousOrder.filter((id) => remoteLogisticIds.has(id) || pendingLogisticIds.has(id));
      const newIds = trip.logistics.map((r) => r.id).filter((id) => !previousOrder.includes(id));
      const nextOrder = [...preserved, ...newIds];
      return arraysEqual(previousOrder, nextOrder) ? map : { ...map, [trip.id]: nextOrder };
    });

    // 5. Dépenses libres : même logique anti-flicker, writer débouncé indépendant.
    const pendingExpenseIds = this.store._pendingExpenseIds();
    const currentExpenses = this.store._expenses();
    const newExpenses = { ...currentExpenses };
    for (const expense of trip.expenses) {
      if (pendingExpenseIds.has(expense.id)) continue;

      const current = currentExpenses[expense.id];
      newExpenses[expense.id] =
        current && JSON.stringify(current) === JSON.stringify(expense)
          ? current
          : expense;
    }

    const remoteExpenseIds = new Set(trip.expenses.map((e) => e.id));
    for (const id of this.store._tripExpenses()[trip.id] ?? []) {
      if (!remoteExpenseIds.has(id) && !pendingExpenseIds.has(id)) delete newExpenses[id];
    }

    if (!recordsShallowEqual(currentExpenses, newExpenses)) {
      this.store._expenses.set(newExpenses);
    }
    this.store._tripExpenses.update((map) => {
      const previousOrder = map[trip.id] ?? [];
      const preserved = previousOrder.filter((id) => remoteExpenseIds.has(id) || pendingExpenseIds.has(id));
      const newIds = trip.expenses.map((e) => e.id).filter((id) => !previousOrder.includes(id));
      const nextOrder = [...preserved, ...newIds];
      return arraysEqual(previousOrder, nextOrder) ? map : { ...map, [trip.id]: nextOrder };
    });
  }
}
