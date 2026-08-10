import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CardComponent } from '@app/shared/components/card/card.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { LogisticFocusService } from '@app/features/trips/trip-detail/logistic-focus.service';
import { computeTasks, TaskItem } from './trip-tasks-tile.util';

interface PlacedActivity {
  dayId: Date;
  activity: Activity;
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

  readonly tasks = computed<TaskItem[]>(() =>
    computeTasks(this.placedActivities(), this.tripFacade.getAllLogistics(this.tripId())()),
  );

  protected onTaskClick(task: TaskItem): void {
    if (task.kind === 'activity') this.dayActivityFocusService.requestFocus(task.dayId.toISOString(), task.activityId);
    else this.logisticFocusService.requestFocus(task.logisticId);
  }
}
