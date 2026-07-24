import { Activity } from '@app/shared/components/activity-card/activity.model';
import { Component, EventEmitter, input, Output } from '@angular/core';

import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { DividerComponent } from '@app/shared/components/divider/divider.component';
import { ACTIVITY_TYPE_META } from '@app/shared/components/activity-card/activity.constants';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [PanelComponent, DatePipe, DividerComponent],
  templateUrl: 'timeline.component.html',
  styleUrl: 'timeline.component.scss',
})
export class TimelineComponent {
  @Output() activitySelected = new EventEmitter<string>();
  readonly activities = input.required<Activity[]>();
  readonly ACTIVITY_TYPE_META = ACTIVITY_TYPE_META;
}
