import { format } from 'date-fns';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { Logistic } from '@core/models/logistic.dto';
import { BookingStatus } from '@core/enums/booking.status';

export type TaskItem =
  | { key: string; label: string; colorVar: string; deadline?: Date; group: 0 | 1 | 2 | 3; kind: 'activity'; dayId: Date; activityId: string }
  | { key: string; label: string; colorVar: string; deadline?: Date; group: 0 | 1 | 2 | 3; kind: 'logistic'; logisticId: string };

function formatLabel(title: string, statusLabel: string, deadline?: Date): string {
  const suffix = deadline ? ` avant le ${format(deadline, 'dd/MM/yy')}` : '';
  return `${title} ${statusLabel}${suffix}`;
}

/**
 * Construit la liste "Pense bête" (activités à réserver/en liste d'attente +
 * réservations logistiques à réserver) — voir `TripTasksTileComponent` pour
 * le contexte/la doc complète. Extrait en fonction pure (testable sans
 * `TestBed`, voir `nesttrip-testing`), même principe que `computeFileGroups`
 * (`trip-files-tile.util.ts`) : `kind`/`dayId`/`activityId`/`logisticId`
 * (pas de closure `onClick`) pour rester une donnée pure, le dispatch du clic
 * (`DayActivityFocusService`/`LogisticFocusService`, injectés) reste à la
 * charge du composant.
 */
export function computeTasks(
  placedActivities: { dayId: Date; activity: Activity }[],
  logistics: Logistic[],
): TaskItem[] {
  const items: TaskItem[] = [];

  for (const { dayId, activity } of placedActivities) {
    const status = activity.booking.status;
    if (status !== BookingStatus.TO_BOOK && status !== BookingStatus.WAITLIST) continue;

    const deadline = activity.booking.deadline;
    const statusLabel = status === BookingStatus.TO_BOOK ? 'à réserver' : "sur liste d'attente";
    items.push({
      key: `activity-${activity.id}`,
      label: formatLabel(activity.title, statusLabel, deadline),
      colorVar: status === BookingStatus.TO_BOOK ? 'var(--nt-red-500)' : 'var(--nt-yellow-500)',
      deadline,
      group: status === BookingStatus.TO_BOOK ? 2 : 3,
      kind: 'activity',
      dayId,
      activityId: activity.id,
    });
  }

  for (const logistic of logistics) {
    if (logistic.booking.status !== BookingStatus.TO_BOOK) continue;

    const deadline = logistic.booking.deadline;
    items.push({
      key: `logistic-${logistic.id}`,
      label: formatLabel(logistic.title, 'à réserver', deadline),
      colorVar: 'var(--nt-red-500)',
      deadline,
      group: logistic.type === 'logement' ? 0 : 1,
      kind: 'logistic',
      logisticId: logistic.id,
    });
  }

  // Tri stable (ES2019+) : préserve l'ordre source (chronologique par jour
  // pour les activités) à l'intérieur de chaque groupe.
  return items.sort((a, b) => {
    const rankA = a.deadline ? 0 : a.group + 1;
    const rankB = b.deadline ? 0 : b.group + 1;
    if (rankA !== rankB) return rankA - rankB;
    return rankA === 0 ? a.deadline!.getTime() - b.deadline!.getTime() : 0;
  });
}
