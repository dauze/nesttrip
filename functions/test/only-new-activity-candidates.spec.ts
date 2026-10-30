import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { onlyNewActivityCandidates } from '../src/trip-generation/only-new-activity-candidates';
import { GeneratedActivityCandidate } from '../src/trip-generation/trip-generation.dto';

const candidate = (candidateId: string, placeId: string): GeneratedActivityCandidate => ({
  candidateId,
  placeId,
  title: candidateId,
  photoRefs: [],
  interest: 'offbeat',
  reason: '',
  excluded: false,
});

describe('onlyNewActivityCandidates', () => {
  it('excludes places from previous batches and duplicates within the new batch', () => {
    const result = onlyNewActivityCandidates([
      candidate('old-place-copy', 'known-place'),
      candidate('new-place', 'new-place'),
      candidate('duplicate-copy', 'new-place'),
      candidate('another-new-place', 'another-new-place'),
    ], ['known-place']);

    assert.deepEqual(result.map((item) => item.placeId), ['new-place', 'another-new-place']);
  });
});