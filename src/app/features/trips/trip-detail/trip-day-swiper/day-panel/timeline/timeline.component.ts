import { ActivityEcho } from '@app/shared/components/activity-card/activity.model';
import { MergedDayEntry } from '../day-logistic-banner/day-timeline-merge';
import { LogisticDayOccurrence } from '../day-logistic-banner/logistic-day-occurrence';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { ACTIVITY_TYPE_META } from '@app/shared/components/activity-card/activity.constants';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [PanelComponent, DividerComponent, DatePipe],
  templateUrl: 'timeline.component.html',
  styleUrl: 'timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineComponent {
  readonly activitySelected = output<string>();
  readonly echoSelected = output<ActivityEcho>();
  /** Clic sur une occurrence logistique : scroll dans le jour (pas de navigation vers l'onglet Logistique) — voir DayPanelComponent.onLogisticEntrySelected. */
  readonly logisticSelected = output<LogisticDayOccurrence>();
  readonly entries = input.required<MergedDayEntry[]>();
  readonly ACTIVITY_TYPE_META = ACTIVITY_TYPE_META;
}
