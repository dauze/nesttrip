import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { remainingActivityBudgetEur } from '../src/trip-generation/apply-budget-cap';
import { GeneratedActivityCandidate } from '../src/trip-generation/trip-generation.dto';

const candidates: GeneratedActivityCandidate[] = [
  { candidateId: 'museum', placeId: 'museum', title: 'Museum', photoRefs: [], interest: 'museums', reason: '', excluded: false, estimatedPriceEur: 20 },
  { candidateId: 'park', placeId: 'park', title: 'Park', photoRefs: [], interest: 'nature', reason: '', excluded: false, estimatedPriceEur: 0 },
  { candidateId: 'tour', placeId: 'tour', title: 'Tour', photoRefs: [], interest: 'offbeat', reason: '', excluded: false, estimatedPriceEur: 15 },
];

describe('remainingActivityBudgetEur', () => {
  it('subtracts the cost of activities already kept', () => {
    assert.equal(remainingActivityBudgetEur(candidates, ['museum', 'park'], 50), 30);
  });

  it('does not return a negative remaining budget', () => {
    assert.equal(remainingActivityBudgetEur(candidates, ['museum', 'tour'], 20), 0);
  });

  it('leaves the budget undefined when no cap is configured', () => {
    assert.equal(remainingActivityBudgetEur(candidates, ['museum'], undefined), undefined);
  });
});