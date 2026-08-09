import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TripStore } from './trip-store.service';
import { ActivityPersistenceService } from '@app/core/infra/firebase/services/persistence/activity-persistence.service';
import { DayActivityInstancePersistenceService } from '@app/core/infra/firebase/services/persistence/day-activity-instance-persistence.service';
import { DayActivitiesPersistenceService } from '@app/core/infra/firebase/services/persistence/day-activities-persistence.service';
import { LogisticPersistenceService } from '@app/core/infra/firebase/services/persistence/logistic-persistence.service';
import { ExpensePersistenceService } from '@app/core/infra/firebase/services/persistence/expense-persistence.service';
import { Expense } from '@core/models/expense.dto';
import { TripPersistenceService } from '@app/core/infra/firebase/services/persistence/trip-persistence';
import { DayPersistenceService } from '@app/core/infra/firebase/services/persistence/day-persistence.service';
import { NotesPersistenceService } from '@app/core/infra/firebase/services/persistence/notes-persistence.service';
import { CollaborationService } from '@app/core/services/collaboration.service';
import { CurrencyConversionService } from '@app/core/services/currency-conversion.service';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { Logistic } from '@core/models/logistic.dto';
import { Trip } from './trip.model';

/** Writer débouncé factice : reproduit l'API publique de `DebounceWriter` (voir shared/debounced-writer.ts) sans jamais toucher Firestore. */
function fakeWriter() {
  return {
    syncing: signal(false),
    hasError: signal(false),
    queueUpdate: vi.fn(),
  };
}

/** Même chose que `fakeWriter`, avec `create`/`remove` (écritures directes non débouncées, voir ExpensePersistenceService/LogisticPersistenceService). */
function fakeCrudWriter() {
  return {
    ...fakeWriter(),
    create: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe('TripStore', () => {
  const tripId = 't1';
  const dayId = new Date('2026-08-01T00:00:00.000Z');

  let activityWriter: ReturnType<typeof fakeWriter>;
  let instanceWriter: ReturnType<typeof fakeWriter>;
  let expenseWriter: ReturnType<typeof fakeCrudWriter>;
  let store: TripStore;

  function poolActivity(overrides: Partial<PoolActivity> = {}): PoolActivity {
    return { id: 'pool-1', title: 'Tour Eiffel', files: [], photoRefs: [], ...overrides };
  }

  function expense(overrides: Partial<Expense> = {}): Expense {
    return {
      id: 'exp-1',
      amount: 5,
      currency: 'THB',
      label: 'Smoothie',
      date: new Date('2026-08-10T12:00:00Z'),
      frozenRateToEur: 39.4,
      frozenAmountEur: 0.13,
      ...overrides,
    };
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

  function logistic(overrides: Partial<Logistic> = {}): Logistic {
    return {
      id: 'log-1',
      type: 'other',
      title: 'Excursion',
      files: [],
      links: [],
      price: { amount: 100, currency: 'USD' },
      booking: { status: BookingStatus.NOT_NEEDED },
      ...overrides,
    } as Logistic;
  }

  let logisticWriter: ReturnType<typeof fakeWriter>;
  let currencyConversionService: { convert$: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    activityWriter = fakeWriter();
    instanceWriter = fakeWriter();
    expenseWriter = fakeCrudWriter();
    logisticWriter = fakeWriter();
    currencyConversionService = { convert$: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: ActivityPersistenceService, useValue: activityWriter },
        { provide: DayActivityInstancePersistenceService, useValue: instanceWriter },
        { provide: DayActivitiesPersistenceService, useValue: fakeWriter() },
        { provide: LogisticPersistenceService, useValue: logisticWriter },
        { provide: ExpensePersistenceService, useValue: expenseWriter },
        { provide: CurrencyConversionService, useValue: currencyConversionService },
        { provide: NotesPersistenceService, useValue: fakeWriter() },
        {
          provide: TripPersistenceService,
          useValue: {
            createTrip: vi.fn().mockResolvedValue(undefined),
            updateTripTitle: vi.fn().mockResolvedValue(undefined),
            updateTripTravelTiers: vi.fn().mockResolvedValue(undefined),
            updateTripTravelModeOverrides: vi.fn().mockResolvedValue(undefined),
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

  describe('updateTripTravelTiers — signal dédié, indépendant de _trips/activeTrip', () => {
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
          logistics: [],
          expenses: [],
          notes: { id: 'n1', items: [] },
          ...overrides,
        },
      });
      store._activeTripId.set(tripId);
    }

    it("met à jour getTripTravelTiers() sans changer la référence de _trips ni de activeTrip()", () => {
      seedTrip();
      const tripsBefore = store._trips();
      const activeTripBefore = store.activeTrip();

      store.updateTripTravelTiers(tripId, { tier1Mode: 'walk', tier1MaxKm: 2, tier2Mode: 'bike', tier2MaxKm: 10, tier3Mode: 'car' });

      expect(store.getTripTravelTiers(tripId)()).toEqual({ tier1Mode: 'walk', tier1MaxKm: 2, tier2Mode: 'bike', tier2MaxKm: 10, tier3Mode: 'car' });
      expect(store._trips()).toBe(tripsBefore);
      expect(store.activeTrip()).toBe(activeTripBefore);
    });

    it("retombe sur trip.travelTiers tant qu'aucun changement n'a été fait, puis sur les valeurs par défaut (marche 1.5 / vélo 8 / sinon voiture)", () => {
      const customTiers = { tier1Mode: 'walk' as const, tier1MaxKm: 3, tier2Mode: 'bike' as const, tier2MaxKm: 12, tier3Mode: 'car' as const };
      seedTrip({ travelTiers: customTiers });
      expect(store.getTripTravelTiers(tripId)()).toEqual(customTiers);
      expect(store.getTripTravelTiers('trip-inconnu')()).toEqual({ tier1Mode: 'walk', tier1MaxKm: 1.5, tier2Mode: 'bike', tier2MaxKm: 8, tier3Mode: 'car' });
    });
  });

  describe('setTravelModeOverride — signal dédié, indépendant de _trips/activeTrip', () => {
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
          logistics: [],
          expenses: [],
          notes: { id: 'n1', items: [] },
          ...overrides,
        },
      });
      store._activeTripId.set(tripId);
    }

    it("ajoute un override sans changer la référence de _trips ni de activeTrip()", () => {
      seedTrip();
      const tripsBefore = store._trips();
      const activeTripBefore = store.activeTrip();

      store.setTravelModeOverride(tripId, 'a_b', 'car');

      expect(store.getTravelModeOverrides(tripId)()).toEqual({ a_b: 'car' });
      expect(store._trips()).toBe(tripsBefore);
      expect(store.activeTrip()).toBe(activeTripBefore);
    });

    it('retombe sur {} tant qu\'aucun override n\'a été fait', () => {
      seedTrip();
      expect(store.getTravelModeOverrides(tripId)()).toEqual({});
    });

    it('conserve les autres overrides en ajoutant/retirant une clé', () => {
      seedTrip({ travelModeOverrides: { a_b: 'bike' } });

      store.setTravelModeOverride(tripId, 'c_d', 'car');
      expect(store.getTravelModeOverrides(tripId)()).toEqual({ a_b: 'bike', c_d: 'car' });

      store.setTravelModeOverride(tripId, 'a_b', null);
      expect(store.getTravelModeOverrides(tripId)()).toEqual({ c_d: 'car' });
    });
  });

  describe('updateTripTitle — signal dédié, indépendant de _trips/activeTrip', () => {
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
          logistics: [],
          expenses: [],
          notes: { id: 'n1', items: [] },
          ...overrides,
        },
      });
      store._activeTripId.set(tripId);
    }

    it("met à jour getTripTitle() sans changer la référence de _trips ni de activeTrip()", () => {
      seedTrip();
      const tripsBefore = store._trips();
      const activeTripBefore = store.activeTrip();

      store.updateTripTitle(tripId, 'Nouveau titre');

      expect(store.getTripTitle(tripId)()).toBe('Nouveau titre');
      expect(store._trips()).toBe(tripsBefore);
      expect(store.activeTrip()).toBe(activeTripBefore);
    });

    it("retombe sur trip.title tant qu'aucun renommage n'a été fait, puis '' à défaut", () => {
      seedTrip({ title: 'Voyage au Japon' });
      expect(store.getTripTitle(tripId)()).toBe('Voyage au Japon');
      expect(store.getTripTitle('trip-inconnu')()).toBe('');
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

    it('insère les nouvelles activités sans date en fin de journée, pas en tête (voir ROADMAP.md "### UI")', () => {
      store.createActivity(tripId, dayId, poolActivity({ id: 'pool-1' }), instance({ id: 'instance-1', activityId: 'pool-1' }));
      store.createActivity(tripId, dayId, poolActivity({ id: 'pool-2' }), instance({ id: 'instance-2', activityId: 'pool-2' }));

      const ids = store.getDayActivities(dayId)().map((a) => a.id);
      expect(ids).toEqual(['instance-1', 'instance-2']);
    });
  });

  describe('updateDayActivityInstance — placement chronologique automatique', () => {
    function seedDay(ids: string[], instancesById: Record<string, DayActivityInstance>) {
      const dayKey = dayId.toISOString();
      store._tripDays.set({ [tripId]: [dayKey] });
      store._dayActivityIds.set({ [dayKey]: ids });
      store._dayActivityInstances.set(instancesById);
    }

    it("replace une instance nouvellement datée au bon endroit chronologique, sans retrier les activités non datées entre elles", () => {
      const morning = instance({ id: 'morning', startTime: '09:00' });
      const evening = instance({ id: 'evening', startTime: '18:00' });
      const untimedA = instance({ id: 'untimed-a' });
      const untimedB = instance({ id: 'untimed-b' });

      seedDay(
        ['untimed-b', 'untimed-a', 'morning', 'evening'],
        { 'untimed-b': untimedB, 'untimed-a': untimedA, morning, evening },
      );

      store.updateDayActivityInstance(tripId, { ...untimedA, startTime: '12:00' });

      expect(store._dayActivityIds()[dayId.toISOString()]).toEqual(['untimed-b', 'morning', 'untimed-a', 'evening']);
    });

    it("ne touche pas l'ordre si l'instance mise à jour n'a pas de startTime", () => {
      seedDay(['a', 'b'], { a: instance({ id: 'a' }), b: instance({ id: 'b' }) });

      store.updateDayActivityInstance(tripId, instance({ id: 'a', notes: 'note modifiée' }));

      expect(store._dayActivityIds()[dayId.toISOString()]).toEqual(['a', 'b']);
    });
  });

  describe('getDayActivitiesWithEchoes — écho lié (activité à cheval sur minuit)', () => {
    const day2 = new Date(dayId.getTime() + 24 * 60 * 60 * 1000);

    function seedTwoDays() {
      store._tripDays.set({ [tripId]: [dayId.toISOString(), day2.toISOString()] });
    }

    it("affiche un écho sur le jour suivant si l'activité franchit minuit", () => {
      seedTwoDays();
      store.createActivity(
        tripId, dayId,
        poolActivity({ id: 'pool-night' }),
        instance({ id: 'night', activityId: 'pool-night', startTime: '22:00', endTime: '01:00' }),
      );

      const entries = store.getDayActivitiesWithEchoes(tripId, day2)();

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        kind: 'echo',
        originInstanceId: 'night',
        title: 'Tour Eiffel',
        startTime: '00:00',
        endTime: '01:00',
      });
    });

    it("ne crée pas d'écho pour une activité qui ne franchit pas minuit", () => {
      seedTwoDays();
      store.createActivity(
        tripId, dayId,
        poolActivity({ id: 'pool-day' }),
        instance({ id: 'day-act', activityId: 'pool-day', startTime: '10:00', endTime: '11:00' }),
      );

      const entries = store.getDayActivitiesWithEchoes(tripId, day2)();

      expect(entries).toEqual([]);
    });

    it("ne plante pas sur le premier jour du trip (pas de jour précédent)", () => {
      seedTwoDays();

      const entries = store.getDayActivitiesWithEchoes(tripId, dayId)();

      expect(entries).toEqual([]);
    });
  });

  describe('getDayActivitiesWithEchoes — endDayOffset explicite (plusieurs jours)', () => {
    const day2 = new Date(dayId.getTime() + 24 * 60 * 60 * 1000);
    const day3 = new Date(dayId.getTime() + 2 * 24 * 60 * 60 * 1000);

    function seedThreeDays() {
      store._tripDays.set({ [tripId]: [dayId.toISOString(), day2.toISOString(), day3.toISOString()] });
    }

    it('génère un écho par jour intermédiaire (sans endTime) et un écho final (avec endTime) pour endDayOffset=2', () => {
      seedThreeDays();
      store.createActivity(
        tripId, dayId,
        poolActivity({ id: 'pool-trek' }),
        instance({ id: 'trek', activityId: 'pool-trek', startTime: '08:00', endTime: '17:00', endDayOffset: 2 }),
      );

      const day2Entries = store.getDayActivitiesWithEchoes(tripId, day2)();
      const day3Entries = store.getDayActivitiesWithEchoes(tripId, day3)();

      expect(day2Entries).toHaveLength(1);
      expect(day2Entries[0]).toMatchObject({ kind: 'echo', originInstanceId: 'trek', startTime: '00:00', endTime: undefined });

      expect(day3Entries).toHaveLength(1);
      expect(day3Entries[0]).toMatchObject({ kind: 'echo', originInstanceId: 'trek', startTime: '00:00', endTime: '17:00' });
    });

    it("ne crée aucun écho au-delà d'endDayOffset", () => {
      seedThreeDays();
      store.createActivity(
        tripId, dayId,
        poolActivity({ id: 'pool-onenight' }),
        instance({ id: 'onenight', activityId: 'pool-onenight', startTime: '22:00', endTime: '01:00', endDayOffset: 1 }),
      );

      const day3Entries = store.getDayActivitiesWithEchoes(tripId, day3)();

      expect(day3Entries).toEqual([]);
    });
  });

  describe('figeage du taux au passage à BOOKED (src/specs/devise.md 3.3)', () => {
    it('fige le taux et le montant EUR au passage TO_BOOK -> BOOKED pour une instance jour', () => {
      currencyConversionService.convert$.mockReturnValue(of({ status: 'success', data: { amount: 92.5, approximate: false } }));

      store.createActivity(
        tripId, dayId,
        poolActivity(),
        instance({ price: { amount: 100, currency: 'USD' }, booking: { status: BookingStatus.TO_BOOK } }),
      );
      store.updateDayActivityInstance(
        tripId,
        instance({ price: { amount: 100, currency: 'USD' }, booking: { status: BookingStatus.BOOKED } }),
      );

      expect(currencyConversionService.convert$).toHaveBeenCalledWith(100, 'USD', 'EUR');
      const price = store.getDayActivity('instance-1')().price;
      expect(price.frozenRateToEur).toBeCloseTo(0.925, 5);
      expect(price.frozenAmountEur).toBe(92.5);
      expect(price.frozenAt).toBeInstanceOf(Date);
    });

    it('ne fige rien si le statut était déjà BOOKED avant (pas de re-figeage à chaque édition ultérieure)', () => {
      store.createActivity(
        tripId, dayId,
        poolActivity(),
        instance({ price: { amount: 100, currency: 'USD' }, booking: { status: BookingStatus.BOOKED } }),
      );
      currencyConversionService.convert$.mockClear();

      store.updateDayActivityInstance(
        tripId,
        instance({ price: { amount: 150, currency: 'USD' }, booking: { status: BookingStatus.BOOKED } }),
      );

      expect(currencyConversionService.convert$).not.toHaveBeenCalled();
      expect(store.getDayActivity('instance-1')().price.frozenAmountEur).toBeUndefined();
    });

    it('ne fige rien pour une transition vers WAITLIST/NOT_NEEDED/TO_BOOK (seul BOOKED fige)', () => {
      store.createActivity(
        tripId, dayId,
        poolActivity(),
        instance({ price: { amount: 100, currency: 'USD' }, booking: { status: BookingStatus.TO_BOOK } }),
      );
      currencyConversionService.convert$.mockClear();

      store.updateDayActivityInstance(
        tripId,
        instance({ price: { amount: 100, currency: 'USD' }, booking: { status: BookingStatus.WAITLIST } }),
      );

      expect(currencyConversionService.convert$).not.toHaveBeenCalled();
    });

    it('fige un taux de 1 sans appel réseau quand la devise est déjà EUR', () => {
      store.createActivity(
        tripId, dayId,
        poolActivity(),
        instance({ price: { amount: 100, currency: 'EUR' }, booking: { status: BookingStatus.TO_BOOK } }),
      );

      store.updateDayActivityInstance(
        tripId,
        instance({ price: { amount: 100, currency: 'EUR' }, booking: { status: BookingStatus.BOOKED } }),
      );

      expect(currencyConversionService.convert$).not.toHaveBeenCalled();
      const price = store.getDayActivity('instance-1')().price;
      expect(price.frozenRateToEur).toBe(1);
      expect(price.frozenAmountEur).toBe(100);
    });

    it('fige le taux au passage à BOOKED pour une réservation logistique', () => {
      currencyConversionService.convert$.mockReturnValue(of({ status: 'success', data: { amount: 92.5, approximate: false } }));
      store._logistics.set({ [logistic().id]: logistic({ booking: { status: BookingStatus.TO_BOOK } }) });

      store.updateLogistic(tripId, logistic({ booking: { status: BookingStatus.BOOKED } }));

      expect(currencyConversionService.convert$).toHaveBeenCalledWith(100, 'USD', 'EUR');
      const price = store.getLogistic('log-1')().price;
      expect(price?.frozenRateToEur).toBeCloseTo(0.925, 5);
      expect(price?.frozenAmountEur).toBe(92.5);
    });

    it('retombe sur un taux 1 si la conversion échoue (offline) plutôt que de bloquer le figeage', () => {
      currencyConversionService.convert$.mockReturnValue(of({ status: 'error' }));
      store.createActivity(
        tripId, dayId,
        poolActivity(),
        instance({ price: { amount: 100, currency: 'USD' }, booking: { status: BookingStatus.TO_BOOK } }),
      );

      store.updateDayActivityInstance(
        tripId,
        instance({ price: { amount: 100, currency: 'USD' }, booking: { status: BookingStatus.BOOKED } }),
      );

      const price = store.getDayActivity('instance-1')().price;
      expect(price.frozenRateToEur).toBe(1);
      expect(price.frozenAmountEur).toBe(100);
    });
  });

  describe('createExpense/updateExpense/removeExpense — dépenses libres (src/specs/devise.md 3.4)', () => {
    it('createExpense met à jour le signal immédiatement et écrit en direct (non débouncé)', () => {
      store.createExpense(tripId, expense());

      expect(store.getExpense('exp-1')()).toEqual(expense());
      expect(store.getAllExpenses(tripId)()).toEqual([expense()]);
      expect(expenseWriter.create).toHaveBeenCalledWith(tripId, expense());
    });

    it("marque la dépense pending dès la commande, jusqu'à ce que le writer redevienne idle", () => {
      store.createExpense(tripId, expense());
      expect(store._pendingExpenseIds().has('exp-1')).toBe(true);

      expenseWriter.syncing.set(false);
      TestBed.tick();
      expect(store._pendingExpenseIds().has('exp-1')).toBe(false);
    });

    it('updateExpense met à jour le signal immédiatement et passe par le writer débouncé', () => {
      store.createExpense(tripId, expense());

      store.updateExpense(tripId, expense({ label: 'Pourboire' }));

      expect(store.getExpense('exp-1')().label).toBe('Pourboire');
      expect(expenseWriter.queueUpdate).toHaveBeenCalledWith(tripId, expect.objectContaining({ label: 'Pourboire' }));
    });

    it('removeExpense retire la dépense du signal et de la liste du trip, et écrit en direct', () => {
      store.createExpense(tripId, expense());

      store.removeExpense(tripId, 'exp-1');

      expect(store.getExpense('exp-1')()).toBeUndefined();
      expect(store.getAllExpenses(tripId)()).toEqual([]);
      expect(expenseWriter.remove).toHaveBeenCalledWith(tripId, 'exp-1');
    });
  });

  describe('trips — tri par proximité de la date du jour (ROADMAP.md "UX / Interactions")', () => {
    function tripWithDay(id: string, dayOffsetFromToday: number): Trip {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + dayOffsetFromToday);
      return {
        id, ville: 'Paris', title: id, ownerId: 'u1', members: {},
        days: [{ id: day, activityIds: [] }],
        activities: [], dayActivityInstances: [], logistics: [], expenses: [],
        notes: { id: `notes-${id}`, items: [] },
      };
    }

    it('place les voyages à venir avant les voyages passés, chacun trié par proximité de la date du jour', () => {
      store.saveTrip(tripWithDay('past-far', -10));
      store.saveTrip(tripWithDay('future-far', 10));
      store.saveTrip(tripWithDay('past-near', -1));
      store.saveTrip(tripWithDay('future-near', 1));

      expect(store.trips().map((t) => t.id)).toEqual([
        'future-near', 'future-far', 'past-near', 'past-far',
      ]);
    });
  });
});
