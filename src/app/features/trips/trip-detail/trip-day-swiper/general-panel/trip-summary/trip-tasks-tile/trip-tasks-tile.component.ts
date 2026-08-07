import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { format } from 'date-fns';
import { CardComponent } from '@app/shared/components/card/card.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { BookingStatus } from '@core/enums/booking.status';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { LogisticFocusService } from '@app/features/trips/trip-detail/logistic-focus.service';

interface PlacedActivity {
  dayId: Date;
  activity: Activity;
}

interface TaskItem {
  key: string;
  label: string;
  colorVar: string;
  deadline?: Date;
  /** 0=logement à réserver, 1=transport à réserver, 2=activité à réserver, 3=activité en liste d'attente. */
  group: 0 | 1 | 2 | 3;
  onClick: () => void;
}

/**
 * Tuile "Pense bête" (onglet Résumé, voir ROADMAP.md "UX / Interactions") : agrège
 * activités à réserver/en liste d'attente + réservations logistiques à
 * réserver, dans un ordre décidé avec l'utilisateur le 2026-08-01 (voir
 * ROADMAP.md) — tout item avec deadline remonte en premier (le plus proche
 * d'abord, quel que soit son statut), puis logements à réserver, transports à
 * réserver, activités à réserver, et enfin les activités en liste d'attente
 * sans deadline.
 */
@Component({
  selector: 'app-trip-tasks-tile',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './trip-tasks-tile.component.html',
  styleUrl: './trip-tasks-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripTasksTileComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly dayActivityFocusService = inject(DayActivityFocusService);
  private readonly logisticFocusService = inject(LogisticFocusService);

  readonly tripId = input.required<string>();
  readonly placedActivities = input.required<PlacedActivity[]>();

  readonly tasks = computed<TaskItem[]>(() => {
    const items: TaskItem[] = [];

    for (const { dayId, activity } of this.placedActivities()) {
      const status = activity.booking.status;
      if (status !== BookingStatus.TO_BOOK && status !== BookingStatus.WAITLIST) continue;

      const deadline = activity.booking.deadline;
      const statusLabel = status === BookingStatus.TO_BOOK ? 'à réserver' : "sur liste d'attente";
      items.push({
        key: `activity-${activity.id}`,
        label: this.formatLabel(activity.title, statusLabel, deadline),
        colorVar: status === BookingStatus.TO_BOOK ? 'var(--nt-red-500)' : 'var(--nt-yellow-500)',
        deadline,
        group: status === BookingStatus.TO_BOOK ? 2 : 3,
        onClick: () => this.dayActivityFocusService.requestFocus(dayId.toISOString(), activity.id),
      });
    }

    for (const logistic of this.tripFacade.getAllLogistics(this.tripId())()) {
      if (logistic.booking.status !== BookingStatus.TO_BOOK) continue;

      const deadline = logistic.booking.deadline;
      items.push({
        key: `logistic-${logistic.id}`,
        label: this.formatLabel(logistic.title, 'à réserver', deadline),
        colorVar: 'var(--nt-red-500)',
        deadline,
        group: logistic.type === 'logement' ? 0 : 1,
        onClick: () => this.logisticFocusService.requestFocus(logistic.id),
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
  });

  private formatLabel(title: string, statusLabel: string, deadline?: Date): string {
    const suffix = deadline ? ` avant le ${format(deadline, 'dd/MM/yy')}` : '';
    return `${title} ${statusLabel}${suffix}`;
  }
}
