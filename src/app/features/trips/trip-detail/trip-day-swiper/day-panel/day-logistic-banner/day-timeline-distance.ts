import { PlaceSummary } from '@core/models/place.dto';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { LogisticDayOccurrence } from './logistic-day-occurrence';
import { MergedDayEntry, mergedEntryKey } from './day-timeline-merge';

export interface TravelPoint {
  placeId: string;
  latitude: number;
  longitude: number;
}

/** Segment "distance à pied" inséré entre 2 entrées consécutives de la timeline fusionnée — voir `insertDistanceGaps`. */
export interface DistanceGapEntry {
  kind: 'gap';
  key: string;
  origin: TravelPoint;
  destination: TravelPoint;
}

export type TimelineEntryWithGap = MergedDayEntry | DistanceGapEntry;

function activityPoint(activity: Activity): TravelPoint | undefined {
  return activity.placeId && activity.latitude != null && activity.longitude != null
    ? { placeId: activity.placeId, latitude: activity.latitude, longitude: activity.longitude }
    : undefined;
}

function placePoint(place: PlaceSummary | undefined): TravelPoint | undefined {
  return place ? { placeId: place.placeId, latitude: place.latitude, longitude: place.longitude } : undefined;
}

/**
 * Point(s) de connexion d'une occurrence logistique avec le reste de la
 * timeline : `before`/`after` diffèrent seulement pour un vol/train dont
 * l'occurrence fusionne départ ET arrivée le même jour (voir
 * `LogisticDayOccurrence.endTime`/`endRole`) — le segment précédent doit
 * mener à l'aéroport/gare de DÉPART, le suivant partir de celui d'ARRIVÉE.
 * Partout ailleurs (logement, location de voiture, vol/train à une seule
 * occurrence ce jour-là), un seul lieu sert aux deux bords.
 */
function logisticEdgePoints(occurrence: LogisticDayOccurrence): { before?: TravelPoint; after?: TravelPoint } {
  const { logistic, role, endRole } = occurrence;

  switch (logistic.type) {
    case 'logement':
    case 'other': {
      const point = placePoint(logistic.place);
      return { before: point, after: point };
    }
    case 'carRental': {
      const point = role === 'Restitution' ? placePoint(logistic.dropoffPlace) : placePoint(logistic.pickupPlace);
      return { before: point, after: point };
    }
    case 'flight':
    case 'train': {
      const departure = placePoint(logistic.type === 'flight' ? logistic.departureAirport : logistic.departurePlace);
      const arrival = placePoint(logistic.type === 'flight' ? logistic.arrivalAirport : logistic.arrivalPlace);
      if (endRole) return { before: departure, after: arrival };
      const point = role === 'Arrivée' ? arrival : departure;
      return { before: point, after: point };
    }
  }
}

/** `echo` volontairement exclu (aucun point) : continuation en lecture seule d'une activité de la veille, pas une "étape" où l'utilisateur marche. */
function entryEdgePoints(entry: MergedDayEntry): { before?: TravelPoint; after?: TravelPoint } {
  if (entry.kind === 'activity') {
    const point = activityPoint(entry.activity);
    return { before: point, after: point };
  }
  if (entry.kind === 'logistic') return logisticEdgePoints(entry.occurrence);
  return {};
}

/**
 * Insère un `DistanceGapEntry` entre chaque paire d'entrées consécutives
 * dont les deux points de connexion sont résolvables et distincts (même
 * `placeId` des deux côtés ⇒ pas de segment, ex. check-in suivi d'une
 * activité sur place) — consommé par `DayPanelComponent` pour l'affichage
 * uniquement, jamais par `DayReorderService`/`DayScrollSyncService` (qui
 * continuent d'itérer `MergedDayEntry[]` sans les segments).
 */
export function insertDistanceGaps(entries: MergedDayEntry[]): TimelineEntryWithGap[] {
  const result: TimelineEntryWithGap[] = [];

  for (let i = 0; i < entries.length; i++) {
    result.push(entries[i]);
    if (i === entries.length - 1) continue;

    const after = entryEdgePoints(entries[i]).after;
    const before = entryEdgePoints(entries[i + 1]).before;
    if (!after || !before || after.placeId === before.placeId) continue;

    result.push({
      kind: 'gap',
      key: `${mergedEntryKey(entries[i])}→${mergedEntryKey(entries[i + 1])}`,
      origin: after,
      destination: before,
    });
  }

  return result;
}
