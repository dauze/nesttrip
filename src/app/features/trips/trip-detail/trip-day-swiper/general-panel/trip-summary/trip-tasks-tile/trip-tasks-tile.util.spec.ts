import { computeTasks } from './trip-tasks-tile.util';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { Logistic } from '@core/models/logistic.dto';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'instance-1',
    activityId: 'pool-1',
    title: 'Visite du Louvre',
    type: ActivityType.VISITE,
    duration: 60,
    price: { amount: 0, currency: 'EUR' },
    booking: { status: BookingStatus.NOT_NEEDED },
    notes: '',
    files: [],
    photoRefs: [],
    ...overrides,
  };
}

function logistic(overrides: Partial<Logistic> = {}): Logistic {
  return {
    id: 'logistic-1',
    type: 'flight',
    title: 'Vol AF1234',
    files: [],
    links: [],
    booking: { status: BookingStatus.NOT_NEEDED },
    ...overrides,
  } as Logistic;
}

const DAY_1 = new Date('2026-08-10T00:00:00.000Z');

describe('computeTasks', () => {
  it('ignore les activités/réservations qui ne sont ni à réserver ni en liste d’attente', () => {
    const tasks = computeTasks([{ dayId: DAY_1, activity: activity() }], [logistic()]);
    expect(tasks).toEqual([]);
  });

  it('inclut une activité à réserver, avec ses identifiants de placement (pas de closure)', () => {
    const tasks = computeTasks(
      [{ dayId: DAY_1, activity: activity({ id: 'instance-1', booking: { status: BookingStatus.TO_BOOK } }) }],
      [],
    );

    expect(tasks).toEqual([
      expect.objectContaining({ kind: 'activity', dayId: DAY_1, activityId: 'instance-1', group: 2 }),
    ]);
  });

  it('inclut une réservation logement à réserver, groupe 0 (priorité la plus haute hors deadline)', () => {
    const tasks = computeTasks([], [logistic({ id: 'log-1', type: 'logement', booking: { status: BookingStatus.TO_BOOK } })]);

    expect(tasks).toEqual([
      expect.objectContaining({ kind: 'logistic', logisticId: 'log-1', group: 0 }),
    ]);
  });

  it('trie les items avec deadline avant ceux sans deadline, par deadline croissante', () => {
    const far = activity({ id: 'far', booking: { status: BookingStatus.TO_BOOK, deadline: new Date('2026-09-01') } });
    const near = activity({ id: 'near', booking: { status: BookingStatus.TO_BOOK, deadline: new Date('2026-08-15') } });
    const noDeadline = activity({ id: 'no-deadline', booking: { status: BookingStatus.WAITLIST } });

    const tasks = computeTasks(
      [
        { dayId: DAY_1, activity: far },
        { dayId: DAY_1, activity: near },
        { dayId: DAY_1, activity: noDeadline },
      ],
      [],
    );

    expect(tasks.map((t) => t.key)).toEqual(['activity-near', 'activity-far', 'activity-no-deadline']);
  });
});
