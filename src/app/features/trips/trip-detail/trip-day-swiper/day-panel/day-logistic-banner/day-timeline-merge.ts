import { DayActivityEntry } from '@app/shared/components/activity-card/activity.model';
import { timeToMinutes } from '@app/shared/components/activity-card/activity-time.util';
import { LogisticDayOccurrence } from './logistic-day-occurrence';

/** Rôles "continuation" (activité déjà en cours ce jour-là, sans horaire ponctuel actionnable) : ne rejoignent jamais la timeline fusionnée, restent épinglés en haut (voir ROADMAP.md "Activités"). */
const CONTINUATION_ONLY_ROLES = new Set(['Nuit sur place', 'En cours']);

export type MergedDayEntry = DayActivityEntry | { kind: 'logistic'; occurrence: LogisticDayOccurrence };

/** Clé stable d'une entrée fusionnée — utilisée pour le tracking `@for` (day-panel.component.html) et pour bâtir les clés des segments de distance (voir day-timeline-distance.ts). */
export function mergedEntryKey(entry: MergedDayEntry): string {
  if (entry.kind === 'echo') return `${entry.originInstanceId}:echo`;
  if (entry.kind === 'logistic') return `${entry.occurrence.logistic.id}:${entry.occurrence.role}`;
  return entry.activity.id;
}

/** Occurrences "Nuit sur place"/"En cours" — alimentent le bandeau épinglé en haut du jour (`DayLogisticBannerComponent`, inchangé pour elles). */
export function pinnedLogisticOccurrences(occurrences: LogisticDayOccurrence[]): LogisticDayOccurrence[] {
  return occurrences.filter((o) => CONTINUATION_ONLY_ROLES.has(o.role));
}

/**
 * Fusionne les activités du jour (+ échos, voir ActivityEcho) et les
 * occurrences logistiques "frontière" (Check-in/out, Départ/Arrivée, Prise en
 * charge/Restitution, Début/Fin) en une seule liste triée chronologiquement.
 * Les activités SANS heure gardent leur position relative (jamais retriées
 * entre elles) — chaque occurrence logistique est simplement insérée au bon
 * endroit par rapport aux entrées TIMÉES uniquement, même principe que
 * `insertChronologically` (voir day-activity-order.util.ts).
 */
export function mergeDayTimeline(entries: DayActivityEntry[], occurrences: LogisticDayOccurrence[]): MergedDayEntry[] {
  // Triées par heure croissante AVANT insertion : chaque occurrence déjà
  // insérée est elle-même ignorée par la comparaison ci-dessous (ternaire, pas
  // de branche `kind === 'logistic'`) — sans ce tri préalable, deux
  // occurrences logistiques traitées hors ordre pourraient se retrouver
  // inversées l'une par rapport à l'autre.
  const boundaryOccurrences = occurrences
    .filter((o) => !CONTINUATION_ONLY_ROLES.has(o.role))
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  const result: MergedDayEntry[] = [...entries];

  for (const occ of boundaryOccurrences) {
    const occMinutes = occ.time.getHours() * 60 + occ.time.getMinutes();
    let insertAt = result.length;

    for (let i = 0; i < result.length; i++) {
      const entry = result[i];
      const entryTime = entry.kind === 'activity' ? entry.activity.startTime : entry.kind === 'echo' ? entry.startTime : undefined;
      if (entryTime === undefined) continue;
      if (timeToMinutes(entryTime) > occMinutes) {
        insertAt = i;
        break;
      }
    }

    result.splice(insertAt, 0, { kind: 'logistic', occurrence: occ });
  }

  return result;
}
