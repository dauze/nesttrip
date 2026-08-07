import { tripFromFb } from './trip.mapper';
import { TripFirebase } from '../models/trip.dto';

function baseTripFb(days: TripFirebase['days']): TripFirebase {
  return {
    id: 't1',
    ville: 'Paris',
    ownerId: 'u1',
    members: {},
    title: 'Trip',
    days,
    activities: {},
    dayActivityInstances: {},
    logistics: {},
    expenses: {},
    notes: { id: 'n1', items: [] },
  };
}

describe('tripFromFb', () => {
  it('trie days par ordre chronologique (clé epoch ms) même si Firestore les renvoie dans le désordre', () => {
    // Un champ `map` Firestore ne garantit pas l'ordre de ses clés au retour
    // (voir ROADMAP.md "UX / Interactions") — reproduit ici un ordre de
    // retour mélangé, observé en conditions réelles après un aller-retour
    // Firestore consécutif à une édition.
    const day1 = new Date('2026-08-10T00:00:00.000Z').getTime();
    const day2 = new Date('2026-08-11T00:00:00.000Z').getTime();
    const day3 = new Date('2026-08-12T00:00:00.000Z').getTime();

    const tripFb = baseTripFb({
      [String(day2)]: { activityIds: [] },
      [String(day3)]: { activityIds: [] },
      [String(day1)]: { activityIds: [] },
    });

    const trip = tripFromFb(tripFb);

    expect(trip.days.map((d) => d.id.getTime())).toEqual([day1, day2, day3]);
  });

  it('conserve activityIds pour chaque jour', () => {
    const day1 = new Date('2026-08-10T00:00:00.000Z').getTime();
    const tripFb = baseTripFb({ [String(day1)]: { activityIds: ['a', 'b'] } });

    const trip = tripFromFb(tripFb);

    expect(trip.days[0].activityIds).toEqual(['a', 'b']);
  });
});
