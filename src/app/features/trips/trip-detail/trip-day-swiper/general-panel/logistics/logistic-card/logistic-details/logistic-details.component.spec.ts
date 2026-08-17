import { BookingStatus } from '@core/enums/booking.status';
import { Logistic } from '@core/models/logistic.dto';
import { initialPlacesFrom } from './logistic-details.component';

function baseLogistic(overrides: Partial<Logistic> = {}): Logistic {
  return {
    id: 'r1',
    type: 'other',
    title: 'Réservation',
    files: [],
    links: [],
    booking: { status: BookingStatus.NOT_NEEDED },
    ...overrides,
  } as Logistic;
}

describe('initialPlacesFrom', () => {
  it('logement/other : place uniquement', () => {
    const place = { placeId: 'p1', name: 'Hôtel', address: '', latitude: 0, longitude: 0 };
    expect(initialPlacesFrom(baseLogistic({ type: 'logement', place }))).toEqual({ place });
    expect(initialPlacesFrom(baseLogistic({ type: 'other', place }))).toEqual({ place });
  });

  it('flight : aéroports de départ/arrivée uniquement', () => {
    const departureAirport = { placeId: 'cdg', name: 'CDG', address: '', latitude: 0, longitude: 0 };
    const arrivalAirport = { placeId: 'jfk', name: 'JFK', address: '', latitude: 0, longitude: 0 };
    expect(initialPlacesFrom(baseLogistic({ type: 'flight', departureAirport, arrivalAirport }))).toEqual({
      departureAirport,
      arrivalAirport,
    });
  });

  it('carRental : lieux de prise en charge/restitution uniquement', () => {
    const pickupPlace = { placeId: 'a1', name: 'Agence A', address: '', latitude: 0, longitude: 0 };
    const dropoffPlace = { placeId: 'a2', name: 'Agence B', address: '', latitude: 0, longitude: 0 };
    expect(initialPlacesFrom(baseLogistic({ type: 'carRental', pickupPlace, dropoffPlace }))).toEqual({
      pickupPlace,
      dropoffPlace,
    });
  });

  it('train : lieux de départ/arrivée uniquement', () => {
    const departurePlace = { placeId: 'g1', name: 'Gare A', address: '', latitude: 0, longitude: 0 };
    const arrivalPlace = { placeId: 'g2', name: 'Gare B', address: '', latitude: 0, longitude: 0 };
    expect(initialPlacesFrom(baseLogistic({ type: 'train', departurePlace, arrivalPlace }))).toEqual({
      departurePlace,
      arrivalPlace,
    });
  });

  it('aucun lieu renseigné : objet avec des champs undefined, pas une erreur', () => {
    expect(initialPlacesFrom(baseLogistic({ type: 'flight' }))).toEqual({
      departureAirport: undefined,
      arrivalAirport: undefined,
    });
  });
});
