import { insertDistanceGaps } from './day-timeline-distance';
import { LogisticDayOccurrence } from './logistic-day-occurrence';
import { MergedDayEntry } from './day-timeline-merge';
import { Activity, ActivityEcho } from '@app/shared/components/activity-card/activity.model';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { FlightLogistic } from '@core/models/logistic.dto';
import { PlaceSummary } from '@core/models/place.dto';

function place(id: string, lat = 48.8, lng = 2.3): PlaceSummary {
  return { placeId: id, name: id, address: id, latitude: lat, longitude: lng };
}

function activityEntry(id: string, placeId?: string): MergedDayEntry {
  const activity: Activity = {
    id,
    activityId: `pool-${id}`,
    title: id,
    type: ActivityType.ACTIVITE,
    duration: 60,
    price: { amount: 0, currency: 'EUR' },
    booking: { status: BookingStatus.NOT_NEEDED },
    notes: '',
    files: [],
    photoRefs: [],
    ...(placeId ? { placeId, latitude: 48.8, longitude: 2.3 } : {}),
  };
  return { kind: 'activity', activity };
}

function echoEntry(id: string): MergedDayEntry {
  const echo: ActivityEcho = {
    kind: 'echo',
    originInstanceId: id,
    originDayId: new Date('2026-08-01'),
    activityId: `pool-${id}`,
    title: id,
    type: ActivityType.ACTIVITE,
    startTime: '00:00',
    photoRefs: [],
  };
  return echo;
}

function flightOccurrence(overrides: Partial<LogisticDayOccurrence>): MergedDayEntry {
  const logistic: FlightLogistic = {
    id: 'flight-1',
    type: 'flight',
    title: 'Vol',
    files: [],
    links: [],
    booking: { status: BookingStatus.NOT_NEEDED },
    departureAirport: place('departure-airport'),
    arrivalAirport: place('arrival-airport'),
  };
  return { kind: 'logistic', occurrence: { logistic, role: 'Départ', time: new Date(), ...overrides } };
}

describe('insertDistanceGaps', () => {
  it('insère un segment entre 2 activités ayant chacune un placeId distinct', () => {
    const entries = [activityEntry('a', 'place-a'), activityEntry('b', 'place-b')];

    const result = insertDistanceGaps(entries);

    expect(result.map((e) => e.kind)).toEqual(['activity', 'gap', 'activity']);
    const gap = result[1];
    expect(gap.kind === 'gap' && gap.origin.placeId).toBe('place-a');
    expect(gap.kind === 'gap' && gap.destination.placeId).toBe('place-b');
  });

  it("n'insère rien si l'une des 2 activités n'a pas de placeId", () => {
    const entries = [activityEntry('a', 'place-a'), activityEntry('b')];

    const result = insertDistanceGaps(entries);

    expect(result.map((e) => e.kind)).toEqual(['activity', 'activity']);
  });

  it('n\'insère rien si les 2 côtés partagent le même placeId', () => {
    const entries = [activityEntry('a', 'place-a'), activityEntry('b', 'place-a')];

    const result = insertDistanceGaps(entries);

    expect(result.map((e) => e.kind)).toEqual(['activity', 'activity']);
  });

  it('exclut les échos du calcul (aucun segment ni avant ni après)', () => {
    const entries = [activityEntry('a', 'place-a'), echoEntry('echo'), activityEntry('b', 'place-b')];

    const result = insertDistanceGaps(entries);

    expect(result.map((e) => e.kind)).toEqual(['activity', 'echo', 'activity']);
  });

  it('occurrence vol fusionnée (départ + arrivée le même jour) : segment précédent → aéroport de départ, segment suivant → aéroport d\'arrivée', () => {
    const entries = [
      activityEntry('before', 'place-before'),
      flightOccurrence({ endTime: new Date(), endRole: 'Arrivée' }),
      activityEntry('after', 'place-after'),
    ];

    const result = insertDistanceGaps(entries);

    expect(result.map((e) => e.kind)).toEqual(['activity', 'gap', 'logistic', 'gap', 'activity']);
    const firstGap = result[1];
    const secondGap = result[3];
    expect(firstGap.kind === 'gap' && firstGap.destination.placeId).toBe('departure-airport');
    expect(secondGap.kind === 'gap' && secondGap.origin.placeId).toBe('arrival-airport');
  });
});
