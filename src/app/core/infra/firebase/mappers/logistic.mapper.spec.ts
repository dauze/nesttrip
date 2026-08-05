import { logisticFromFb, logisticToFb } from './logistic.mapper';
import { LogisticFirebase } from '../models/logistic.dto';
import { Logistic } from '@core/models/logistic.dto';
import { BookingStatus } from '@core/enums/booking.status';

describe('logistic.mapper', () => {
  describe('logisticToFb', () => {
    it("omet startDateTime/endDateTime plutôt que de les écrire à undefined quand la réservation n'a pas encore de date (voir ROADMAP.md — jamais préremplie à la création)", () => {
      const logistic: Logistic = {
        id: 'r1',
        type: 'other',
        title: 'Sans date',
        files: [],
        links: [],
        booking: { status: BookingStatus.NOT_NEEDED },
      };

      const result = logisticToFb(logistic);

      expect('startDateTime' in result).toBe(false);
      expect('endDateTime' in result).toBe(false);
    });

    it('sérialise startDateTime/endDateTime en epoch ms (string) quand ils sont renseignés', () => {
      const start = new Date('2026-08-01T10:00:00Z');
      const end = new Date('2026-08-01T12:00:00Z');
      const logistic: Logistic = {
        id: 'r2',
        type: 'other',
        title: 'Avec dates',
        startDateTime: start,
        endDateTime: end,
        files: [],
        links: [],
        booking: { status: BookingStatus.NOT_NEEDED },
      };

      const result = logisticToFb(logistic);

      expect(result.startDateTime).toBe(String(start.getTime()));
      expect(result.endDateTime).toBe(String(end.getTime()));
    });
  });

  describe('logisticFromFb', () => {
    it('retombe sur startDateTime/endDateTime undefined quand absents côté Firestore', () => {
      const fb: LogisticFirebase = {
        id: 'r1',
        type: 'other',
        title: 'Sans date',
        booking: { status: BookingStatus.NOT_NEEDED },
      };

      const result = logisticFromFb(fb);

      expect(result.startDateTime).toBeUndefined();
      expect(result.endDateTime).toBeUndefined();
    });

    it('est symétrique (fromFb ∘ toFb) sur des dates données', () => {
      const start = new Date('2026-09-15T08:30:00Z');
      const end = new Date('2026-09-16T10:00:00Z');
      const logistic: Logistic = {
        id: 'r3',
        type: 'other',
        title: 'Round-trip',
        startDateTime: start,
        endDateTime: end,
        files: [],
        links: [],
        booking: { status: BookingStatus.NOT_NEEDED },
      };

      const roundTripped = logisticFromFb(logisticToFb(logistic));

      expect(roundTripped.startDateTime).toEqual(start);
      expect(roundTripped.endDateTime).toEqual(end);
    });
  });
});
