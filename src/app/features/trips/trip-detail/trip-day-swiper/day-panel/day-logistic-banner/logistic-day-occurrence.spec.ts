import { getLogisticDayOccurrences } from './logistic-day-occurrence';
import { FlightLogistic, TrainLogistic } from '@core/models/logistic.dto';
import { BookingStatus } from '@core/enums/booking.status';

function flight(startDateTime?: Date, endDateTime?: Date): FlightLogistic {
  return {
    id: 'flight-1',
    type: 'flight',
    title: 'Vol Paris → Tokyo',
    files: [],
    links: [],
    booking: { status: BookingStatus.NOT_NEEDED },
    startDateTime,
    endDateTime,
  };
}

function train(startDateTime?: Date, endDateTime?: Date): TrainLogistic {
  return {
    id: 'train-1',
    type: 'train',
    title: 'Train Paris → Lyon',
    files: [],
    links: [],
    booking: { status: BookingStatus.NOT_NEEDED },
    startDateTime,
    endDateTime,
  };
}

describe('getLogisticDayOccurrences — vol/train', () => {
  it('fusionne Départ et Arrivée en une seule occurrence quand elles tombent le même jour', () => {
    const day = new Date('2026-08-02T00:00:00');
    const departure = new Date('2026-08-02T14:30:00');
    const arrival = new Date('2026-08-02T18:45:00');

    const occurrences = getLogisticDayOccurrences(flight(departure, arrival), day);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({ role: 'Départ', time: departure, endRole: 'Arrivée', endTime: arrival });
  });

  it('garde deux occurrences séparées (Départ puis Arrivée) quand le trajet chevauche deux jours', () => {
    const departureDay = new Date('2026-08-02T00:00:00');
    const arrivalDay = new Date('2026-08-03T00:00:00');
    const departure = new Date('2026-08-02T23:00:00');
    const arrival = new Date('2026-08-03T06:00:00');
    const logistic = train(departure, arrival);

    const departureOccurrences = getLogisticDayOccurrences(logistic, departureDay);
    const arrivalOccurrences = getLogisticDayOccurrences(logistic, arrivalDay);

    expect(departureOccurrences).toEqual([{ logistic, role: 'Départ', time: departure }]);
    expect(arrivalOccurrences).toEqual([{ logistic, role: 'Arrivée', time: arrival }]);
  });

  it('ne renvoie rien tant que les dates ne sont pas renseignées', () => {
    expect(getLogisticDayOccurrences(flight(), new Date('2026-08-02T00:00:00'))).toEqual([]);
  });
});
