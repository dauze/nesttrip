import { computeFileGroups } from './trip-files-tile.util';
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

const FILE_A = { path: 'a.pdf', name: 'a.pdf', url: 'https://x/a.pdf' };
const FILE_B = { path: 'b.pdf', name: 'b.pdf', url: 'https://x/b.pdf' };

describe('computeFileGroups', () => {
  it('ignore les activités/réservations sans fichier', () => {
    expect(computeFileGroups([{ activity: activity() }], [logistic()])).toEqual([]);
  });

  it("déduplique une activité posée sur plusieurs jours (même activityId), garde la 1re occurrence", () => {
    const placed = [
      { activity: activity({ id: 'instance-1', activityId: 'pool-1', files: [FILE_A] }) },
      { activity: activity({ id: 'instance-2', activityId: 'pool-1', files: [FILE_A] }) },
    ];
    const groups = computeFileGroups(placed, []);

    expect(groups.length).toBe(1);
    expect(groups[0].key).toBe('activity:pool-1');
    expect(groups[0].files).toEqual([FILE_A]);
  });

  it('liste les activités avant les réservations logistiques, dans l’ordre reçu', () => {
    const placed = [{ activity: activity({ activityId: 'pool-1', title: 'Louvre', files: [FILE_A] }) }];
    const logistics = [logistic({ id: 'log-1', title: 'Vol', files: [FILE_B] })];

    const groups = computeFileGroups(placed, logistics);

    expect(groups.map((g) => g.key)).toEqual(['activity:pool-1', 'logistic:log-1']);
    expect(groups[0].title).toBe('Louvre');
    expect(groups[1].title).toBe('Vol');
  });

  it("retombe sur le libellé du type si le titre est vide", () => {
    const placed = [{ activity: activity({ title: '', files: [FILE_A] }) }];
    const groups = computeFileGroups(placed, []);
    expect(groups[0].title).toBe('Visite');
  });
});
