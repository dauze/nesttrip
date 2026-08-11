import { activityFromFb, activityToFb, bookingFromFb, bookingToFb, priceFromFb, priceToFb } from './activity.mapper';
import { ActivityFirebase, BookingFirebase, PriceFirebase } from '../models/activity.dto';
import { BookingStatus } from '@core/enums/booking.status';
import { Price } from '@app/shared/components/activity-card/activity.model';

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

    it("n'écrit pas source pour une activité créée manuellement", () => {
      const result = activityToFb({ id: 'act-4', title: 'Manuelle', files: [], photoRefs: [] });

      expect('source' in result).toBe(false);
    });

    it('écrit source pour une activité issue de la génération IA', () => {
      const result = activityToFb({ id: 'act-5', title: 'Générée', files: [], photoRefs: [], source: 'ai_generated' });

      expect(result.source).toBe('ai_generated');
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

  describe('priceFromFb / priceToFb', () => {
    it("n'écrit aucun champ frozen* tant que le taux n'a jamais été figé", () => {
      const result = priceToFb({ amount: 42, currency: 'THB' });

      expect('frozenRateToEur' in result).toBe(false);
      expect('frozenAmountEur' in result).toBe(false);
      expect('frozenAt' in result).toBe(false);
    });

    it('lit un prix sans champs frozen* côté Firestore sans planter (statut jamais passé à BOOKED)', () => {
      const fb: PriceFirebase = { amount: 42, currency: 'THB' };

      const result = priceFromFb(fb);

      expect(result).toEqual({ amount: 42, currency: 'THB' });
    });

    it('sérialise frozenAt (Date) en epoch ms (string) quand le taux est figé', () => {
      const frozenAt = new Date('2026-08-01T10:00:00Z');
      const price: Price = { amount: 42, currency: 'THB', frozenRateToEur: 39.4, frozenAmountEur: 1.07, frozenAt };

      const result = priceToFb(price);

      expect(result.frozenRateToEur).toBe(39.4);
      expect(result.frozenAmountEur).toBe(1.07);
      expect(result.frozenAt).toBe(String(frozenAt.getTime()));
    });

    it('est symétrique (fromFb ∘ toFb) sur un prix figé', () => {
      const frozenAt = new Date('2026-08-01T10:00:00Z');
      const price: Price = { amount: 42, currency: 'THB', frozenRateToEur: 39.4, frozenAmountEur: 1.07, frozenAt };

      expect(priceFromFb(priceToFb(price))).toEqual(price);
    });
  });
});
