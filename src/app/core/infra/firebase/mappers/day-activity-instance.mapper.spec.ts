import { dayActivityInstanceFromFb, dayActivityInstanceToFb } from './day-activity-instance.mapper';
import { DayActivityInstanceFirebase } from '../models/day-activity-instance.dto';
import { DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';

describe('day-activity-instance.mapper', () => {
  const baseFb: DayActivityInstanceFirebase = {
    id: 'inst-1',
    activityId: 'pool-1',
    type: ActivityType.ACTIVITE,
    duration: 60,
    price: { amount: 0, currency: 'EUR' },
  };

  describe('dayActivityInstanceFromFb', () => {
    it('lit une heure déjà au format "HH:mm" telle quelle', () => {
      const result = dayActivityInstanceFromFb({ ...baseFb, startTime: '09:30', endTime: '11:00' });

      expect(result.startTime).toBe('09:30');
      expect(result.endTime).toBe('11:00');
    });

    it("convertit l'ancien format epoch-ms stringifié en \"HH:mm\"", () => {
      const d = new Date('2026-08-02T14:05:00');
      const result = dayActivityInstanceFromFb({ ...baseFb, startTime: String(d.getTime()) });

      expect(result.startTime).toBe('14:05');
    });

    it('renvoie undefined si startTime/endTime est absent ou vide', () => {
      const result = dayActivityInstanceFromFb({ ...baseFb, startTime: '', endTime: undefined });

      expect(result.startTime).toBeUndefined();
      expect(result.endTime).toBeUndefined();
    });

    it('lit endDayOffset tel quel, undefined si absent (rétro-compatibilité, voir resolveEndDayOffset)', () => {
      expect(dayActivityInstanceFromFb({ ...baseFb, endDayOffset: 2 }).endDayOffset).toBe(2);
      expect(dayActivityInstanceFromFb(baseFb).endDayOffset).toBeUndefined();
    });
  });

  describe('dayActivityInstanceToFb', () => {
    const instance: DayActivityInstance = {
      id: 'inst-1',
      activityId: 'pool-1',
      type: ActivityType.ACTIVITE,
      duration: 60,
      price: { amount: 0, currency: 'EUR' },
      booking: { status: BookingStatus.NOT_NEEDED },
      notes: '',
    };

    it('écrit toujours au format "HH:mm", jamais en epoch-ms', () => {
      const result = dayActivityInstanceToFb({ ...instance, startTime: '09:30', endTime: '11:00' });

      expect(result.startTime).toBe('09:30');
      expect(result.endTime).toBe('11:00');
    });

    it("écrit une chaîne vide si startTime/endTime est absent", () => {
      const result = dayActivityInstanceToFb(instance);

      expect(result.startTime).toBe('');
      expect(result.endTime).toBe('');
    });

    it('est symétrique (fromFb ∘ toFb) sur une heure donnée', () => {
      const fb = dayActivityInstanceToFb({ ...instance, startTime: '08:15' });

      expect(dayActivityInstanceFromFb(fb).startTime).toBe('08:15');
    });

    it('est symétrique (fromFb ∘ toFb) sur endDayOffset', () => {
      const fb = dayActivityInstanceToFb({ ...instance, endDayOffset: 3 });

      expect(fb.endDayOffset).toBe(3);
      expect(dayActivityInstanceFromFb(fb).endDayOffset).toBe(3);
    });
  });
});
