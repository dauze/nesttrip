import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ActivityEcho } from '../activity.model';
import { ACTIVITY_TYPE_META } from '../activity.constants';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';

/**
 * Écho en lecture seule d'une activité de la veille dont la plage horaire
 * franchit minuit (voir `ActivityEcho`, `TripStore.getDayActivitiesWithEchoes`,
 * ROADMAP.md "Activités") — jamais de form, jamais de poignée de drag : le
 * tap navigue vers l'instance réelle sur son jour d'origine.
 */
@Component({
  selector: 'app-activity-echo-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-echo-card.component.html',
  styleUrl: './activity-echo-card.component.scss',
})
export class ActivityEchoCardComponent {
  private readonly focusService = inject(DayActivityFocusService);

  readonly echo = input.required<ActivityEcho>();
  readonly typeMeta = ACTIVITY_TYPE_META;

  onTap(): void {
    const echo = this.echo();
    this.focusService.requestFocus(echo.originDayId.toISOString(), echo.originInstanceId);
  }
}
