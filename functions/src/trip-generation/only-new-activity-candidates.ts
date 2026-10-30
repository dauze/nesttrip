import { GeneratedActivityCandidate } from './trip-generation.dto';

export function onlyNewActivityCandidates(
  candidates: GeneratedActivityCandidate[],
  knownPlaceIds: Iterable<string>,
): GeneratedActivityCandidate[] {
  const seenPlaceIds = new Set(knownPlaceIds);
  return candidates.filter((candidate) => {
    if (seenPlaceIds.has(candidate.placeId)) return false;
    seenPlaceIds.add(candidate.placeId);
    return true;
  });
}