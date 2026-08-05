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
import { CollaborationService } from '@app/core/services/collaboration.service';

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

  let facade: TripFacade;
  let store: TripStore;
  let tripSubject: Subject<Trip>;

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
      notes: { id: 'notes-1', items: [] },
      ...overrides,
    };
  }

  beforeEach(() => {
    tripSubject = new Subject<Trip>();

    TestBed.configureTestingModule({
      providers: [
        TripFacade,
        TripStore,
        { provide: ActivityPersistenceService, useValue: fakeWriter() },
        { provide: DayActivityInstancePersistenceService, useValue: fakeWriter() },
        { provide: DayActivitiesPersistenceService, useValue: fakeWriter() },
        { provide: LogisticPersistenceService, useValue: fakeWriter() },
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
});
