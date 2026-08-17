import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { TripFacade } from './trip-facade.service';
import { TripStore } from './trip-store.service';
import { TripRepository } from '@app/core/infra/firebase/services/trip-repository';
import { Trip } from './trip.model';
import { ActivityPersistenceService } from '@app/core/infra/firebase/services/persistence/activity-persistence.service';
import { DayActivityInstancePersistenceService } from '@app/core/infra/firebase/services/persistence/day-activity-instance-persistence.service';
import { DayActivitiesPersistenceService } from '@app/core/infra/firebase/services/persistence/day-activities-persistence.service';
import { LogisticPersistenceService } from '@app/core/infra/firebase/services/persistence/logistic-persistence.service';
import { TripPersistenceService } from '@app/core/infra/firebase/services/persistence/trip-persistence';
import { DayPersistenceService } from '@app/core/infra/firebase/services/persistence/day-persistence.service';
import { NotesPersistenceService } from '@app/core/infra/firebase/services/persistence/notes-persistence.service';
import { CollaborationService } from '@app/core/services/api/collaboration.service';
import { CurrencyConversionService } from '@app/core/services/api/currency-conversion.service';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { NotesType } from '@core/enums/notes.type';
import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { Item } from './trip-detail/trip-day-swiper/general-panel/notes/notes.model';

/** Writer débouncé factice : reproduit l'API publique de `DebounceWriter` (voir shared/debounced-writer.ts) sans jamais toucher Firestore — même gabarit que trip-store.service.spec.ts. */
function fakeWriter() {
  return {
    syncing: signal(false),
    hasError: signal(false),
    queueUpdate: vi.fn(),
  };
}

describe('TripFacade.mergeFromRemote (via loadTrip)', () => {
  const tripId = 't1';
  const day1 = new Date('2026-08-01T00:00:00.000Z');
  const day2 = new Date('2026-08-02T00:00:00.000Z');
  const day3 = new Date('2026-08-03T00:00:00.000Z');

  let facade: TripFacade;
  let store: TripStore;
  let tripSubject: Subject<Trip>;
  let dayPersistence: { addDay: ReturnType<typeof vi.fn>; removeDay: ReturnType<typeof vi.fn> };

  function baseTrip(overrides: Partial<Trip> = {}): Trip {
    return {
      id: tripId,
      ville: 'Paris',
      title: 'Voyage à Paris',
      ownerId: 'owner-1',
      members: {},
      days: [{ id: day1, activityIds: [] }],
      activities: [],
      dayActivityInstances: [],
      logistics: [],
      expenses: [],
      notes: { id: 'notes-1', items: [] },
      ...overrides,
    };
  }

  function poolActivity(overrides: Partial<PoolActivity> = {}): PoolActivity {
    return { id: 'pool-1', title: 'Tour Eiffel', files: [], photoRefs: [], ...overrides };
  }

  function noteItem(overrides: Partial<Item> = {}): Item {
    return { id: 'item-1', title: 'À emporter', type: NotesType.TODO, elements: [], ...overrides };
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
    tripSubject = new Subject<Trip>();
    dayPersistence = { addDay: vi.fn().mockResolvedValue(undefined), removeDay: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        TripFacade,
        TripStore,
        { provide: ActivityPersistenceService, useValue: fakeWriter() },
        { provide: DayActivityInstancePersistenceService, useValue: fakeWriter() },
        { provide: DayActivitiesPersistenceService, useValue: fakeWriter() },
        { provide: LogisticPersistenceService, useValue: fakeWriter() },
        { provide: NotesPersistenceService, useValue: fakeWriter() },
        { provide: CurrencyConversionService, useValue: { convert$: vi.fn() } },
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
        { provide: DayPersistenceService, useValue: dayPersistence },
        {
          provide: CollaborationService,
          useValue: {
            addCollaborator: vi.fn().mockReturnValue(of({ success: true, uid: 'u1', email: 'a@b.com', displayName: null })),
            removeCollaborator: vi.fn().mockReturnValue(of({ success: true })),
          },
        },
        {
          provide: TripRepository,
          useValue: {
            getTrips$: vi.fn().mockReturnValue(of([])),
            getTrip$: vi.fn().mockReturnValue(tripSubject.asObservable()),
          },
        },
      ],
    });

    facade = TestBed.inject(TripFacade);
    store = TestBed.inject(TripStore);

    facade.loadTrip(tripId);
    tripSubject.next(baseTrip());
  });

  it('garde la même référence _trips/_tripDays/_days quand un snapshot distant ne change rien à ces champs (régression UI optimiste)', () => {
    const tripsRefBefore = store._trips();
    const tripDaysRefBefore = store._tripDays();
    const daysRefBefore = store._days();
    const activeTripBefore = facade.activeTrip();

    // Snapshot distant déclenché par l'édition d'une activité ailleurs dans
    // le même document Firestore (titre/jours identiques, juste une activité
    // en plus) : ne doit PAS toucher _trips/_tripDays/_days.
    tripSubject.next(
      baseTrip({
        activities: [{ id: 'pool-1', title: 'Tour Eiffel', files: [], photoRefs: [] }],
      }),
    );

    expect(store._trips()).toBe(tripsRefBefore);
    expect(store._tripDays()).toBe(tripDaysRefBefore);
    expect(store._days()).toBe(daysRefBefore);
    expect(facade.activeTrip()!.title).toBe(activeTripBefore!.title);
  });

  it('garde la même référence de getDayActivities(jour) quand un snapshot distant ne change rien pour ce jour (régression "toute la page se réactualise")', () => {
    tripSubject.next(
      baseTrip({
        activities: [poolActivity()],
        dayActivityInstances: [instance()],
        days: [{ id: day1, activityIds: ['instance-1'] }],
      }),
    );

    const day1ActivitiesBefore = store.getDayActivities(day1)();
    expect(day1ActivitiesBefore.length).toBe(1);

    // Confirmation Firestore strictement identique (round-trip qui suit
    // n'importe quelle autre écriture du même document trip) — avant le
    // correctif, `_dayActivityIds`/`_poolActivities`/`_dayActivityInstances`
    // recevaient chacun une NOUVELLE référence container à chaque snapshot,
    // même sans aucun changement réel, faisant réexécuter (et republier) le
    // `computed()` de `getDayActivities` pour TOUS les jours du trip.
    tripSubject.next(
      baseTrip({
        activities: [poolActivity()],
        dayActivityInstances: [instance()],
        days: [{ id: day1, activityIds: ['instance-1'] }],
      }),
    );

    expect(store.getDayActivities(day1)()).toBe(day1ActivitiesBefore);
  });

  it('ne réactualise pas les activités du jour 1 quand une activité du jour 2 est éditée à distance', () => {
    tripSubject.next(
      baseTrip({
        activities: [poolActivity(), poolActivity({ id: 'pool-2', title: 'Louvre' })],
        dayActivityInstances: [instance(), instance({ id: 'instance-2', activityId: 'pool-2' })],
        days: [
          { id: day1, activityIds: ['instance-1'] },
          { id: day2, activityIds: ['instance-2'] },
        ],
      }),
    );

    const day1ActivitiesBefore = store.getDayActivities(day1)();

    // Édition du prix de l'activité du JOUR 2 uniquement.
    tripSubject.next(
      baseTrip({
        activities: [poolActivity(), poolActivity({ id: 'pool-2', title: 'Louvre' })],
        dayActivityInstances: [
          instance(),
          instance({ id: 'instance-2', activityId: 'pool-2', price: { amount: 15, currency: 'EUR' } }),
        ],
        days: [
          { id: day1, activityIds: ['instance-1'] },
          { id: day2, activityIds: ['instance-2'] },
        ],
      }),
    );

    expect(store.getDayActivities(day1)()).toBe(day1ActivitiesBefore);
    expect(store.getDayActivities(day2)()[0].price?.amount).toBe(15);
  });

  it('réactualise bien les activités du jour quand son activité change réellement', () => {
    tripSubject.next(
      baseTrip({
        activities: [poolActivity()],
        dayActivityInstances: [instance()],
        days: [{ id: day1, activityIds: ['instance-1'] }],
      }),
    );

    const day1ActivitiesBefore = store.getDayActivities(day1)();

    tripSubject.next(
      baseTrip({
        activities: [poolActivity()],
        dayActivityInstances: [instance({ notes: 'Réserver à l’avance' })],
        days: [{ id: day1, activityIds: ['instance-1'] }],
      }),
    );

    const day1ActivitiesAfter = store.getDayActivities(day1)();
    expect(day1ActivitiesAfter).not.toBe(day1ActivitiesBefore);
    expect(day1ActivitiesAfter[0].notes).toBe('Réserver à l’avance');
  });

  it('met à jour le titre et les jours quand ils changent réellement à distance', () => {
    tripSubject.next(
      baseTrip({
        title: 'Voyage à Lyon',
        days: [{ id: day1, activityIds: [] }, { id: day2, activityIds: [] }],
      }),
    );

    expect(facade.getTripTitle(tripId)()).toBe('Voyage à Lyon');
    expect(facade.activeTrip()!.days.map((d) => d.id.getTime()).sort()).toEqual(
      [day1.getTime(), day2.getTime()].sort(),
    );
  });

  it('retire un jour supprimé à distance de _days/_tripDays', () => {
    tripSubject.next(
      baseTrip({
        days: [{ id: day1, activityIds: [] }, { id: day2, activityIds: [] }],
      }),
    );
    expect(facade.activeTrip()!.days.length).toBe(2);

    tripSubject.next(baseTrip({ days: [{ id: day2, activityIds: [] }] }));

    expect(facade.activeTrip()!.days.map((d) => d.id.getTime())).toEqual([day2.getTime()]);
  });

  it("ignore les snapshots intermédiaires pendant que plusieurs addDay sont en vol (édition de l'intervalle de dates, régression \"lance toujours le rechargement\")", async () => {
    let resolveSecond!: () => void;
    dayPersistence.addDay
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSecond = resolve; }));

    tripSubject.next(baseTrip({ days: [{ id: day1, activityIds: [] }] }));

    // Édition de l'intervalle de dates : ajoute day2 ET day3 d'un coup (2
    // `addDay` en vol pour le même trip, comme `TripSummaryComponent.onDatesChange`).
    store.addDay(tripId, { id: day2, activityIds: [] });
    store.addDay(tripId, { id: day3, activityIds: [] });
    expect(facade.activeTrip()!.days.length).toBe(3);

    // Laisse le premier `addDay` (day2) se résoudre, pas le second (day3 encore en vol).
    await Promise.resolve();
    await Promise.resolve();

    // Snapshot INTERMÉDIAIRE : le serveur ne reflète encore QUE day2, pas
    // day3 (écriture encore en vol) — ne doit PAS faire "reculer" l'état
    // local (day3 doit rester présent, l'UI ne doit pas cligoter).
    tripSubject.next(baseTrip({ days: [{ id: day1, activityIds: [] }, { id: day2, activityIds: [] }] }));
    expect(facade.activeTrip()!.days.map((d) => d.id.getTime()).sort()).toEqual(
      [day1.getTime(), day2.getTime(), day3.getTime()].sort(),
    );

    // La 2e écriture se confirme à son tour.
    resolveSecond();
    await Promise.resolve();
    await Promise.resolve();

    // Snapshot final, cette fois avec les 3 jours : pending levé, tout concorde déjà.
    tripSubject.next(
      baseTrip({ days: [{ id: day1, activityIds: [] }, { id: day2, activityIds: [] }, { id: day3, activityIds: [] }] }),
    );
    expect(facade.activeTrip()!.days.map((d) => d.id.getTime()).sort()).toEqual(
      [day1.getTime(), day2.getTime(), day3.getTime()].sort(),
    );
  });

  it('getTripDateRange reste stable si les jours ne changent pas, et se met à jour quand ils changent réellement (local ou distant)', () => {
    tripSubject.next(baseTrip({ days: [{ id: day1, activityIds: [] }] }));
    const rangeBefore = facade.getTripDateRange(tripId)();
    expect(rangeBefore).toEqual([day1, day1]);

    // Snapshot sans rapport (édition d'une activité) : la plage ne doit pas changer de référence.
    tripSubject.next(
      baseTrip({
        days: [{ id: day1, activityIds: [] }],
        activities: [poolActivity()],
      }),
    );
    expect(facade.getTripDateRange(tripId)()).toBe(rangeBefore);

    // Un jour est réellement ajouté à distance (ex. un autre collaborateur a étendu le voyage).
    tripSubject.next(
      baseTrip({
        days: [{ id: day1, activityIds: [] }, { id: day2, activityIds: [] }],
        activities: [poolActivity()],
      }),
    );
    const rangeAfter = facade.getTripDateRange(tripId)();
    expect(rangeAfter).not.toBe(rangeBefore);
    expect(rangeAfter).toEqual([day1, day2]);
  });

  it("ne casse pas la référence de _trips en confirmant un renommage local (régression \"toute la page se réactualise\" à l'édition du titre)", async () => {
    const tripsRefBefore = store._trips();

    facade.updateTripTitle(tripId, 'Voyage à Lyon');
    expect(facade.getTripTitle(tripId)()).toBe('Voyage à Lyon');

    // Snapshot de confirmation, avant même que l'écriture Firestore (mockée,
    // asynchrone) ne soit résolue — `trip.id` est encore "pending" : le bloc
    // titre/devise de `mergeFromRemote` doit être entièrement ignoré.
    tripSubject.next(baseTrip({ title: 'Voyage à Lyon' }));
    expect(store._trips()).toBe(tripsRefBefore);

    // Laisse le `.finally()` de la promesse (mockée résolue) vider le pending.
    await Promise.resolve();
    await Promise.resolve();

    // Nouveau snapshot confirmé, cette fois pending levé : la valeur
    // effective (shadow "Voyage à Lyon") égale déjà le titre distant, donc
    // toujours aucune écriture dans _trips.
    tripSubject.next(baseTrip({ title: 'Voyage à Lyon' }));
    expect(store._trips()).toBe(tripsRefBefore);
    expect(facade.getTripTitle(tripId)()).toBe('Voyage à Lyon');
  });

  it('applique un renommage fait par un AUTRE collaborateur même après mon propre renommage local confirmé', async () => {
    facade.updateTripTitle(tripId, 'Voyage à Lyon');
    await Promise.resolve();
    await Promise.resolve();
    tripSubject.next(baseTrip({ title: 'Voyage à Lyon' }));
    expect(facade.getTripTitle(tripId)()).toBe('Voyage à Lyon');

    // Un AUTRE collaborateur renomme entre-temps, pas moi (pas de nouvel
    // appel à updateTripTitle) : le prochain snapshot distant doit s'appliquer
    // en direct, pas rester masqué par mon renommage passé.
    tripSubject.next(baseTrip({ title: 'Voyage à Marseille' }));
    expect(facade.getTripTitle(tripId)()).toBe('Voyage à Marseille');
  });

  /**
   * `TripFacade.hasTrip` (nouveau, 2026-08-05) : sert à `TripSummaryComponent`
   * pour savoir à partir de quand préférer le signal dédié protégé
   * (`getTripDateRange`/`getTripTitle`) à la valeur "rapide" issue de
   * `trips()` — voir la doc de `hasTrip` et le correctif de
   * `TripSummaryComponent.tripDateRange`/`tripTitle` (régression "après
   * modification des dates, ce sont les anciennes dates qui sont affichées").
   */
  it('hasTrip devient vrai une fois le trip hydraté (déjà vrai ici via le beforeEach)', () => {
    expect(facade.hasTrip(tripId)).toBe(true);
    expect(facade.hasTrip('un-autre-trip-jamais-chargé')).toBe(false);
  });

  describe('Notes (mergeFromRemote, régression "jamais resynchronisées en temps réel")', () => {
    it('récupère un item de note créé par un autre collaborateur', () => {
      expect(facade.getNotesItems(tripId)()).toEqual([]);

      tripSubject.next(baseTrip({ notes: { id: 'notes-1', items: [noteItem()] } }));

      expect(facade.getNotesItems(tripId)()).toEqual([noteItem()]);
    });

    it('retire un item de note supprimé à distance', () => {
      tripSubject.next(baseTrip({ notes: { id: 'notes-1', items: [noteItem(), noteItem({ id: 'item-2' })] } }));
      expect(facade.getNotesItems(tripId)().length).toBe(2);

      tripSubject.next(baseTrip({ notes: { id: 'notes-1', items: [noteItem()] } }));

      expect(facade.getNotesItems(tripId)().map((i) => i.id)).toEqual(['item-1']);
    });

    it("ignore un snapshot distant tant qu'une écriture locale de note est encore en vol (anti-flicker)", () => {
      tripSubject.next(baseTrip({ notes: { id: 'notes-1', items: [noteItem()] } }));

      // Édition locale optimiste : `createItem` marque tout de suite tripId comme pending
      // (writer débouncé mocké, jamais "syncing" ici — la protection retombe seulement quand
      // l'effect() observe `syncing() === false`, ce qui est déjà vrai avec `fakeWriter()` : on
      // vérifie donc explicitement l'état juste après l'appel, avant tout flush).
      facade.updateItem(tripId, 'item-1', { title: 'Titre en cours de frappe' });
      expect(facade.getNotesItems(tripId)()[0].title).toBe('Titre en cours de frappe');

      // Snapshot distant qui ne reflète pas encore cette frappe (round-trip d'une autre
      // écriture du même document) : ne doit pas faire "reculer" le titre local.
      tripSubject.next(baseTrip({ notes: { id: 'notes-1', items: [noteItem()] } }));

      expect(facade.getNotesItems(tripId)()[0].title).toBe('Titre en cours de frappe');
    });

    it("respecte l'ordre distant des notes (champ array Firestore, pas un Record)", () => {
      tripSubject.next(
        baseTrip({ notes: { id: 'notes-1', items: [noteItem(), noteItem({ id: 'item-2' })] } }),
      );
      expect(facade.getNotesItems(tripId)().map((i) => i.id)).toEqual(['item-1', 'item-2']);

      tripSubject.next(
        baseTrip({ notes: { id: 'notes-1', items: [noteItem({ id: 'item-2' }), noteItem()] } }),
      );
      expect(facade.getNotesItems(tripId)().map((i) => i.id)).toEqual(['item-2', 'item-1']);
    });
  });
});
