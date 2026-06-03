import {Activity} from '../activity.model';
import { Component, input } from '@angular/core';

import { SelectModule } from 'primeng/select';
import {FormsModule} from '@angular/forms';
import { PanelModule } from 'primeng/panel';
import {DividerModule} from 'primeng/divider';
import {ACTIVITY_TYPE_META} from '../activity-card/activity.constants';
import { DurationPipe } from '../../../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [SelectModule, FormsModule, PanelModule, DurationPipe, DividerModule],
  templateUrl: 'timeline.component.html',
  styleUrl: 'timeline.component.scss',
})
export class TimelineComponent {
  readonly activities = input.required<Activity[]>();
  readonly ACTIVITY_TYPE_META = ACTIVITY_TYPE_META;
}
