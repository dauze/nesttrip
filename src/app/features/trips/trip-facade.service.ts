import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { Day, Trip } from './trip.model';
import { Activity } from '@app/shared/components/activity-card/activity.model';
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

  // ── Commandes ─────────────────────────────────────────────────────────────

  saveTrip(trip: Trip): void {
    this.store.saveTrip(trip);
  }

  updateTripTitle(trip: Trip): void {
    this.store.updateTripTitle(trip);
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

  /** Crée une activité rattachée à un jour donné (elle rejoint aussi le pool général du trip). */
  createActivity(tripId: string, dayId: Date, activity: Activity): void {
    this.store.createActivity(tripId, dayId, activity);
  }

  /** Crée une activité directement dans le pool général du trip, sans jour associé. */
  createGeneralActivity(tripId: string, activity: Activity): void {
    this.store.createGeneralActivity(tripId, activity);
  }

  /** Met à jour une activité (pointeur unique) : se répercute partout où elle est affichée. */
  updateActivity(tripId: string, activity: Activity): void {
    this.store.updateActivity(tripId, activity);
  }

  /** Supprime une activité du trip. `dayId` est optionnel (activité non dispatchée). */
  removeActivity(tripId: string, activityId: string, dayId?: Date): void {
    this.store.removeActivity(tripId, activityId, dayId);
  }

  reorderActivities(tripId: string, dayId: Date, ids: string[]): void {
    this.store.reorderActivities(tripId, dayId, ids);
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

  getActivities = this.store.getActivities.bind(this.store);
  getActivity = this.store.getActivity.bind(this.store);
  /** Toutes les activités d'un trip (dispatchées dans un jour ou non). */
  getAllActivities = this.store.getAllActivities.bind(this.store);
  /** Map activityId -> dayId pour les activités actuellement rattachées à un jour. */
  getActivityDayIds = this.store.getActivityDayIds.bind(this.store);
  getNotesItems = this.store.getNotesItems.bind(this.store);

  // ── Hydratation ───────────────────────────────────────────────────────────

  private hydrate(trip: Trip): void {
    const newTrips = { ...this.store._trips() };
    const newDays = { ...this.store._days() };
    const newActivities = { ...this.store._activities() };
    const newTripDays = { ...this.store._tripDays() };
    const newDayActivities = { ...this.store._dayActivities() };
    const newTripActivities = { ...this.store._tripActivities() };
    const notesItems = { ...this.store._notesItems() };
    const tripNotesItems = { ...this.store._tripNotesItems() };

    const previousDayKeys = newTripDays[trip.id] ?? [];
    for (const dayKey of previousDayKeys) {
      delete newDayActivities[dayKey];
      delete newDays[dayKey];
    }

    const previousActivityIds = newTripActivities[trip.id] ?? [];
    for (const activityId of previousActivityIds) {
      delete newActivities[activityId];
    }

    const previousItemIds = tripNotesItems[trip.id] ?? [];
    for (const itemId of previousItemIds) {
      delete notesItems[itemId];
    }

    delete tripNotesItems[trip.id];
    delete newTripDays[trip.id];
    delete newTripActivities[trip.id];

    newTrips[trip.id] = { ...trip, days: [], activities: [] };
    newTripDays[trip.id] = [];
    newTripActivities[trip.id] = [];
    tripNotesItems[trip.id] = [];

    for (const item of trip.notes.items) {
      notesItems[item.id] = item;
      tripNotesItems[trip.id].push(item.id);
    }

    // 1. Le pool d'activités du trip est la source de vérité.
    for (const activity of trip.activities) {
      newActivities[activity.id] = activity;
      newTripActivities[trip.id].push(activity.id);
    }

    // 2. Les jours ne stockent que des références vers ce pool.
    for (const day of trip.days) {
      const dayKey = day.id.toISOString();
      newDays[dayKey] = { ...day, activityIds: [] };
      newTripDays[trip.id].push(dayKey);
      newDayActivities[dayKey] = [...day.activityIds];
    }

    this.store._trips.set(newTrips);
    this.store._days.set(newDays);
    this.store._activities.set(newActivities);
    this.store._tripDays.set(newTripDays);
    this.store._dayActivities.set(newDayActivities);
    this.store._tripActivities.set(newTripActivities);
    this.store._notesItems.set(notesItems);
    this.store._tripNotesItems.set(tripNotesItems);
  }

   private mergeFromRemote(trip: Trip): void {
    const currentActivities = this.store._activities();
    const newActivities = { ...currentActivities };
    const newDayActivities: Record<string, string[]> = {};
    const pendingIds = this.store._pendingActivityIds();

    // 1. Pool d'activités : source de vérité unique, qu'elles soient
    // dispatchées ou non dans un jour.
    for (const activity of trip.activities) {
      // Une édition locale de cette activité n'a pas encore été confirmée
      // par Firestore (write debouncée en cours) : on ne laisse PAS ce
      // snapshot (potentiellement encore ancien côté serveur) écraser
      // l'état optimiste local, sinon l'UI "revient en arrière" pendant la
      // fenêtre de debounce à chaque édition.
      if (pendingIds.has(activity.id)) continue;

      const current = currentActivities[activity.id];
      newActivities[activity.id] =
        current && JSON.stringify(current) === JSON.stringify(activity)
          ? current
          : activity;
    }

    // Nettoyage des activités supprimées côté distant
    const remoteIds = new Set(trip.activities.map((a) => a.id));
    for (const id of this.store._tripActivities()[trip.id] ?? []) {
      if (!remoteIds.has(id) && !pendingIds.has(id)) delete newActivities[id];
    }

    // 2. Références jour -> activités
    for (const day of trip.days) {
      const dayKey = day.id.toISOString();
      newDayActivities[dayKey] = [...day.activityIds];
    }

    this.store._activities.set(newActivities);
    this.store._dayActivities.set(newDayActivities);
    this.store._tripActivities.update((map) => ({
      ...map,
      [trip.id]: trip.activities.map((a) => a.id),
    }));
  }
}
