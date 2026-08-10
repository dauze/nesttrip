import { tripFromFb, tripToFb } from './trip.mapper';
import { TripFirebase } from '../models/trip.dto';
import { Trip } from '@app/features/trips/trip.model';

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

function baseTrip(): Trip {
  return {
    id: 't1',
    ville: 'Paris',
    ownerId: 'u1',
    members: {},
    title: 'Trip',
    days: [],
    activities: [],
    dayActivityInstances: [],
    logistics: [],
    expenses: [],
    notes: { id: 'n1', items: [] },
  };
}

describe('tripToFb', () => {
  it('omet photoRef quand absent, plutôt que de l\'écrire à undefined (Firestore le rejette)', () => {
    const tripFb = tripToFb(baseTrip());

    expect('photoRef' in tripFb).toBe(false);
  });

  it('conserve photoRef quand présent', () => {
    const tripFb = tripToFb({ ...baseTrip(), photoRef: 'places/xyz/photos/abc' });

    expect(tripFb.photoRef).toBe('places/xyz/photos/abc');
  });
});

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
