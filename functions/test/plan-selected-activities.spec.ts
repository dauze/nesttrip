import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyActivityAssignments,
  distributeActivitiesAcrossDays,
  planSelectedActivities,
} from '../src/trip-generation/plan-selected-activities';
import { GeneratedActivityCandidate, TripAiPreferences } from '../src/trip-generation/trip-generation.dto';

const candidates: GeneratedActivityCandidate[] = [
  { candidateId: 'museum', placeId: 'place-museum', title: 'Museum', photoRefs: [], interest: 'museums', reason: '', excluded: false },
  { candidateId: 'park', placeId: 'place-park', title: 'Park', photoRefs: [], interest: 'nature', reason: '', excluded: false },
];

const preferences: TripAiPreferences = {
  assistanceLevel: 'activities_day',
  travelerType: null,
  pace: 'balanced',
  interests: [],
  multiCity: false,
  cities: [],
  freeText: '',
};

describe('plan-selected-activities', () => {
  it('applies the LLM order and day assignments without changing candidate data', () => {
    const result = applyActivityAssignments(candidates, [
      { candidateId: 'park', day: 1 },
      { candidateId: 'museum', day: 0 },
    ], 2);

    assert.deepEqual(result?.map(({ candidateId, day }) => ({ candidateId, day })), [
      { candidateId: 'museum', day: 0 },
      { candidateId: 'park', day: 1 },
    ]);
    assert.equal(result?.[0].placeId, 'place-museum');
  });

  it('rejects missing, duplicate, unknown, and out-of-range assignments', () => {
    assert.equal(applyActivityAssignments(candidates, [{ candidateId: 'museum', day: 0 }], 2), null);
    assert.equal(applyActivityAssignments(candidates, [
      { candidateId: 'museum', day: 0 },
      { candidateId: 'museum', day: 1 },
    ], 2), null);
    assert.equal(applyActivityAssignments(candidates, [
      { candidateId: 'museum', day: 0 },
      { candidateId: 'unknown', day: 1 },
    ], 2), null);
    assert.equal(applyActivityAssignments(candidates, [
      { candidateId: 'museum', day: 0 },
      { candidateId: 'park', day: 2 },
    ], 2), null);
  });

  it('distributes all selected candidates deterministically when Gemini is unavailable', async () => {
    const result = await planSelectedActivities(
      candidates,
      preferences,
      { ville: 'Rome', placeId: 'rome', latitude: 0, longitude: 0 },
      [Date.UTC(2026, 9, 30), Date.UTC(2026, 9, 31), Date.UTC(2026, 10, 1)],
      undefined,
    );

    assert.deepEqual(result.map(({ candidateId, day }) => ({ candidateId, day })), [
      { candidateId: 'museum', day: 0 },
      { candidateId: 'park', day: 1 },
    ]);
    assert.deepEqual(distributeActivitiesAcrossDays([], 3), []);
  });
});