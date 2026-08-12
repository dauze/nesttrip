import { tripGenerationFromFb, tripGenerationToFb } from './trip-generation.mapper';
import { TripGenerationFirebase } from '../models/trip-generation.dto';
import { TripGeneration } from '@app/features/trips/new-trip/trip-generation.model';
import { createDefaultAiPreferences } from '@app/features/trips/new-trip/trip-ai-preferences.model';

describe('trip-generation.mapper', () => {
  describe('tripGenerationFromFb', () => {
    it('convertit createdAt/updatedAt (epoch ms) en Date', () => {
      const fb: TripGenerationFirebase = {
        tripId: 'trip-1',
        status: 'generating',
        preferences: { ...createDefaultAiPreferences() },
        destination: { ville: 'Rome', placeId: 'place-1', latitude: 41.9, longitude: 12.5 },
        tripDayDates: [1_700_000_000_000],
        candidates: [],
        preview: [],
        lodgingCandidates: [],
        lodgingPreview: [],
        transportSegments: [],
        generalNotes: [],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      };

      const result = tripGenerationFromFb(fb);

      expect(result.createdAt).toEqual(new Date(1_700_000_000_000));
      expect(result.updatedAt).toEqual(new Date(1_700_000_100_000));
    });

    it('remplace candidates/preview/lodging*/transportSegments/tripDayDates absents par des tableaux vides', () => {
      const fb = {
        tripId: 'trip-2',
        status: 'generating',
        preferences: createDefaultAiPreferences(),
        destination: { ville: 'Rome', placeId: 'place-1', latitude: 41.9, longitude: 12.5 },
        createdAt: 0,
        updatedAt: 0,
      } as TripGenerationFirebase;

      const result = tripGenerationFromFb(fb);

      expect(result.candidates).toEqual([]);
      expect(result.preview).toEqual([]);
      expect(result.lodgingCandidates).toEqual([]);
      expect(result.lodgingPreview).toEqual([]);
      expect(result.transportSegments).toEqual([]);
      expect(result.tripDayDates).toEqual([]);
      expect(result.generalNotes).toEqual([]);
    });
  });

  describe('tripGenerationToFb', () => {
    const baseJob: TripGeneration = {
      tripId: 'trip-3',
      status: 'generating',
      preferences: createDefaultAiPreferences(),
      destination: { ville: 'Rome', placeId: 'place-1', latitude: 41.9, longitude: 12.5 },
      tripDayDates: [1_700_000_000_000],
      candidates: [],
      preview: [],
      lodgingCandidates: [],
      lodgingPreview: [],
      transportSegments: [],
      generalNotes: [],
      createdAt: new Date('2026-08-01T10:00:00Z'),
      updatedAt: new Date('2026-08-01T10:00:00Z'),
    };

    it("n'écrit pas error tant qu'aucune erreur n'est survenue", () => {
      const result = tripGenerationToFb(baseJob);

      expect('error' in result).toBe(false);
    });

    it('écrit error une fois le job en échec', () => {
      const result = tripGenerationToFb({ ...baseJob, status: 'failed', error: 'Erreur serveur' });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Erreur serveur');
    });

    it("omet les champs optionnels absents d'un candidat (address/latitude/longitude/rating)", () => {
      const job: TripGeneration = {
        ...baseJob,
        preview: [
          {
            candidateId: 'c1',
            placeId: 'c1',
            title: 'Colisée',
            photoRefs: [],
            interest: 'offbeat',
            reason: 'Choisi pour ton intérêt insolite',
            excluded: false,
          },
        ],
      };

      const result = tripGenerationToFb(job);

      expect('address' in result.preview[0]).toBe(false);
      expect('latitude' in result.preview[0]).toBe(false);
      expect('longitude' in result.preview[0]).toBe(false);
      expect('rating' in result.preview[0]).toBe(false);
      expect('timeOfDay' in result.preview[0]).toBe(false);
      expect('suggestedStartMinutes' in result.preview[0]).toBe(false);
      expect('notes' in result.preview[0]).toBe(false);
    });

    it("omet relatedCandidateId d'une note générale non liée", () => {
      const job: TripGeneration = {
        ...baseJob,
        generalNotes: [{ id: 'note-0', title: 'À emporter', type: 'TODO', points: ['Adaptateur'], excluded: false }],
      };

      const result = tripGenerationToFb(job);

      expect('relatedCandidateId' in result.generalNotes![0]).toBe(false);
    });

    it("n'écrit pas dayStartHour/dayEndHour tant qu'aucune heure n'a été détectée", () => {
      const result = tripGenerationToFb(baseJob);

      expect('dayStartHour' in result).toBe(false);
      expect('dayEndHour' in result).toBe(false);
    });

    it('est symétrique (fromFb ∘ toFb) sur un job complet (activité placée sur un jour, logement, transport, timeOfDay, heures de journée, notes générales liée/non liée)', () => {
      const job: TripGeneration = {
        ...baseJob,
        dayStartHour: 11,
        dayEndHour: 2,
        preview: [
          {
            candidateId: 'c1',
            placeId: 'c1',
            title: 'Colisée',
            address: 'Piazza del Colosseo',
            latitude: 41.89,
            longitude: 12.49,
            rating: 4.7,
            photoRefs: ['ref-1'],
            interest: 'offbeat',
            reason: 'Choisi pour ton intérêt insolite',
            excluded: false,
            day: 2,
            timeOfDay: 'night',
            suggestedStartMinutes: 630,
            notes: 'Réserver à l\'avance',
          },
        ],
        lodgingPreview: [
          {
            candidateId: 'h1',
            placeId: 'h1',
            title: 'Hôtel Roma',
            photoRefs: [],
            city: 'Rome',
            reason: '',
            excluded: false,
          },
        ],
        transportSegments: [
          { id: 't1', fromCity: 'Rome', toCity: 'Florence', distanceKm: 230, estimatedLabel: '~2h estimées (route/train)' },
        ],
        generalNotes: [
          { id: 'note-0', title: 'À emporter', type: 'TODO', points: ['Adaptateur', 'Passeport'], excluded: false, relatedCandidateId: 'c1' },
          { id: 'note-1', title: 'Bon à savoir', type: 'INFO', points: ['Pourboire non attendu'], excluded: false },
        ],
      };

      expect(tripGenerationFromFb(tripGenerationToFb(job))).toEqual(job);
    });

    it("n'écrit pas day pour une activité en mode activities_only (non placée)", () => {
      const job: TripGeneration = {
        ...baseJob,
        preview: [
          { candidateId: 'c1', placeId: 'c1', title: 'Colisée', photoRefs: [], interest: 'offbeat', reason: '', excluded: false },
        ],
      };

      const result = tripGenerationToFb(job);

      expect('day' in result.preview[0]).toBe(false);
    });
  });
});
