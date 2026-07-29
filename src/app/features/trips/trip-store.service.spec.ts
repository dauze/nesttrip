import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TripStore } from './trip-store.service';
import { ActivityPersistenceService } from '@app/core/infra/firebase/services/persistence/activity-persistence.service';
import { DayActivityInstancePersistenceService } from '@app/core/infra/firebase/services/persistence/day-activity-instance-persistence.service';
import { DayActivitiesPersistenceService } from '@app/core/infra/firebase/services/persistence/day-activities-persistence.service';
import { ReservationPersistenceService } from '@app/core/infra/firebase/services/persistence/reservation-persistence.service';
import { TripPersistenceService } from '@app/core/infra/firebase/services/persistence/trip-persistence';
import { DayPersistenceService } from '@app/core/infra/firebase/services/persistence/day-persistence.service';
import { NotesPersistenceService } from '@app/core/infra/firebase/services/persistence/notes-persistence.service';
import { CollaborationService } from '@app/core/services/collaboration.service';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';

/** Writer débouncé factice : reproduit l'API publique de `DebounceWriter` (voir shared/debounced-writer.ts) sans jamais toucher Firestore. */
function fakeWriter() {
  return {
    syncing: signal(false),
    hasError: signal(false),
    queueUpdate: vi.fn(),
  };
}

describe('TripStore', () => {
  const tripId = 't1';
  const dayId = new Date('2026-08-01T00:00:00.000Z');

  let activityWriter: ReturnType<typeof fakeWriter>;
  let instanceWriter: ReturnType<typeof fakeWriter>;
  let store: TripStore;

  function poolActivity(overrides: Partial<PoolActivity> = {}): PoolActivity {
    return { id: 'pool-1', title: 'Tour Eiffel', files: [], photoRefs: [], ...overrides };
  }

  function instance(overrides: Partial<DayActivityInstance> = {}): DayActivityInstance {
    return {
      id: 'instance-1',
      activityId: 'pool-1',
      type: ActivityType.VISITE,
      duration: 60,
      price: { amount: 0, currency: 'EUR' },
      booking: { status: BookingStatus.NOT_NEEDED },
      notes: '',
      ...overrides,
    };
  }

  beforeEach(() => {
    activityWriter = fakeWriter();
    instanceWriter = fakeWriter();

    TestBed.configureTestingModule({
      providers: [
        { provide: ActivityPersistenceService, useValue: activityWriter },
        { provide: DayActivityInstancePersistenceService, useValue: instanceWriter },
        { provide: DayActivitiesPersistenceService, useValue: fakeWriter() },
        { provide: ReservationPersistenceService, useValue: fakeWriter() },
        { provide: NotesPersistenceService, useValue: fakeWriter() },
        {
          provide: TripPersistenceService,
          useValue: {
            createTrip: vi.fn().mockResolvedValue(undefined),
            updateTripTitle: vi.fn().mockResolvedValue(undefined),
            updateTripCurrency: vi.fn().mockResolvedValue(undefined),
            removeTrip: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DayPersistenceService,
          useValue: {
            addDay: vi.fn().mockResolvedValue(undefined),
            removeDay: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CollaborationService,
          useValue: {
            addCollaborator: vi.fn().mockReturnValue(of({ success: true, uid: 'u1', email: 'a@b.com', displayName: null })),
            removeCollaborator: vi.fn().mockReturnValue(of({ success: true })),
          },
        },
      ],
    });

    store = TestBed.inject(TripStore);
  });

  describe('updatePoolActivity — mise à jour optimiste', () => {
    it('met à jour le signal immédiatement, avant toute confirmation Firestore', () => {
      store.createGeneralActivity(tripId, poolActivity());

      store.updatePoolActivity(tripId, poolActivity({ title: 'Tour Eiffel (rénovée)' }));

      expect(store.getPoolActivity('pool-1')().title).toBe('Tour Eiffel (rénovée)');
      expect(activityWriter.queueUpdate).toHaveBeenCalledWith(tripId, expect.objectContaining({ title: 'Tour Eiffel (rénovée)' }));
    });

    it('marque l\'activité pending dès la commande, sans attendre le writer', () => {
      store.updatePoolActivity(tripId, poolActivity());

      expect(store._pendingActivityIds().has('pool-1')).toBe(true);
    });
  });

  describe('anti-flicker (_pendingActivityIds)', () => {
    it("reste protégée tant que l'un des deux writers (pool ou instance) est encore en train de synchroniser", () => {
      store.updatePoolActivity(tripId, poolActivity());
      expect(store._pendingActivityIds().has('pool-1')).toBe(true);

      activityWriter.syncing.set(true);
      TestBed.tick();

      expect(store._pendingActivityIds().has('pool-1')).toBe(true);
    });

    it('ne relâche la protection que lorsque les DEUX writers redeviennent idle en même temps', () => {
      store.updatePoolActivity(tripId, poolActivity());
      store.updateDayActivityInstance(tripId, instance());
      expect(store._pendingActivityIds()).toEqual(new Set(['pool-1', 'instance-1']));

      // Le writer d'instances est encore en train de flush : la protection doit tenir,
      // même si le writer d'activités, lui, est déjà retombé à idle.
      instanceWriter.syncing.set(true);
      activityWriter.syncing.set(false);
      TestBed.tick();
      expect(store._pendingActivityIds()).toEqual(new Set(['pool-1', 'instance-1']));

      // Les deux writers sont maintenant idle : tout le lot pending est relâché d'un coup.
      instanceWriter.syncing.set(false);
      TestBed.tick();
      expect(store._pendingActivityIds().size).toBe(0);
    });
  });

  describe('updateTripCurrency — signal dédié, indépendant de _trips/activeTrip', () => {
    function seedTrip(overrides: Partial<import('./trip.model').Trip> = {}) {
      store._trips.set({
        [tripId]: {
          id: tripId,
          ville: 'Paris',
          title: 'Voyage',
          ownerId: 'u1',
          members: {},
          days: [],
          activities: [],
          dayActivityInstances: [],
          reservations: [],
          notes: { id: 'n1', items: [] },
          defaultCurrency: 'EUR',
          ...overrides,
        },
      });
      store._activeTripId.set(tripId);
    }

    it("met à jour getTripCurrency() sans changer la référence de _trips ni de activeTrip()", () => {
      seedTrip();
      const tripsBefore = store._trips();
      const activeTripBefore = store.activeTrip();

      store.updateTripCurrency(tripId, 'USD');

      expect(store.getTripCurrency(tripId)()).toBe('USD');
      expect(store._trips()).toBe(tripsBefore);
      expect(store.activeTrip()).toBe(activeTripBefore);
    });

    it("retombe sur trip.defaultCurrency tant qu'aucun changement n'a été fait, puis 'EUR' à défaut", () => {
      seedTrip({ defaultCurrency: 'JPY' });
      expect(store.getTripCurrency(tripId)()).toBe('JPY');
      expect(store.getTripCurrency('trip-inconnu')()).toBe('EUR');
    });
  });

  describe('createActivity — création pool + instance en une commande', () => {
    it("compose immédiatement la vue du jour à partir du form de l'instance et de l'identité du pool", () => {
      store.createActivity(tripId, dayId, poolActivity(), instance());

      const dayActivities = store.getDayActivities(dayId)();

      expect(dayActivities).toHaveLength(1);
      expect(dayActivities[0]).toMatchObject({
        id: 'instance-1',
        activityId: 'pool-1',
        title: 'Tour Eiffel',
        type: ActivityType.VISITE,
      });
    });
  });
});
