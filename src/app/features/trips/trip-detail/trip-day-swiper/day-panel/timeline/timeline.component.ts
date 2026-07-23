import { Activity } from '@app/shared/components/activity-card/activity.model';
import { Component, EventEmitter, input, Output } from '@angular/core';

import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { PanelModule } from 'primeng/panel';
import { DividerModule } from 'primeng/divider';
import { ACTIVITY_TYPE_META } from '@app/shared/components/activity-card/activity.constants';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [SelectModule, FormsModule, PanelModule, DatePipe, DividerModule],
  templateUrl: 'timeline.component.html',
  styleUrl: 'timeline.component.scss',
})
export class TimelineComponent {
  @Output() activitySelected = new EventEmitter<string>();
  readonly activities = input.required<Activity[]>();
  readonly ACTIVITY_TYPE_META = ACTIVITY_TYPE_META;
}
