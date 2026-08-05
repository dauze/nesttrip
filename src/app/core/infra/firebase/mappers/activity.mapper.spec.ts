import { activityFromFb, activityToFb, bookingFromFb, bookingToFb } from './activity.mapper';
import { ActivityFirebase, BookingFirebase } from '../models/activity.dto';
import { BookingStatus } from '@core/enums/booking.status';

describe('activity.mapper', () => {
  describe('activityFromFb', () => {
    it('mappe une activité complète telle quelle', () => {
      const fb: ActivityFirebase = {
        id: 'act-1',
        title: 'Tour Eiffel',
        files: [{ url: 'https://x/file.pdf', name: 'billet.pdf', path: 'trips/t1/act-1/billet.pdf' }],
        placeId: 'place-1',
        address: '5 Avenue Anatole France',
        latitude: 48.8584,
        longitude: 2.2945,
        photoRefs: ['ref-1', 'ref-2'],
      };

      expect(activityFromFb(fb)).toEqual({
        ...fb,
        files: fb.files,
        photoRefs: fb.photoRefs,
      });
    });

    it("remplace files et photoRefs absents par des tableaux vides", () => {
      const fb: ActivityFirebase = { id: 'act-2', title: 'Sans fichiers' };

      const result = activityFromFb(fb);

      expect(result.files).toEqual([]);
      expect(result.photoRefs).toEqual([]);
    });
  });

  describe('activityToFb', () => {
    it("remplace files absent par un tableau vide et ne fixe pas photoRefs", () => {
      const result = activityToFb({
        id: 'act-3',
        title: 'Sans fichiers',
        files: undefined as unknown as [],
        photoRefs: ['ref-1'],
      });

      expect(result.files).toEqual([]);
      expect(result.photoRefs).toEqual(['ref-1']);
    });
  });

  describe('bookingFromFb / bookingToFb', () => {
    it('convertit un deadline Firestore (string epoch ms) en Date', () => {
      const epochMs = 1_700_000_000_000;
      const fb: BookingFirebase = { status: BookingStatus.TO_BOOK, deadline: String(epochMs) };

      const result = bookingFromFb(fb);

      expect(result.status).toBe(BookingStatus.TO_BOOK);
      expect(result.deadline).toEqual(new Date(epochMs));
    });

    it("retombe sur une Date par défaut si deadline est absent", () => {
      const result = bookingFromFb({ status: BookingStatus.NOT_NEEDED });

      expect(result.deadline).toBeInstanceOf(Date);
    });

    it('convertit un deadline Date en string epoch ms pour Firestore', () => {
      const deadline = new Date('2026-08-01T10:00:00Z');

      const result = bookingToFb({ status: BookingStatus.BOOKED, deadline });

      expect(result.deadline).toBe(String(deadline.getTime()));
    });

    it("retombe sur une chaîne vide si deadline est absent", () => {
      const result = bookingToFb({ status: BookingStatus.WAITLIST });

      expect(result.deadline).toBe('');
    });

    it('est symétrique (fromFb ∘ toFb) sur un deadline donné', () => {
      const deadline = new Date('2026-09-15T08:30:00Z');
      const fb = bookingToFb({ status: BookingStatus.BOOKED, deadline });

      expect(bookingFromFb(fb).deadline).toEqual(deadline);
    });
  });
});
