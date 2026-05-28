import { Component, input } from '@angular/core';

import { SelectModule } from 'primeng/select';
import {FormsModule} from '@angular/forms';
import { Activity } from '../../../../core/models/dto/activity.interface';
import { PanelModule } from 'primeng/panel';
import {DividerModule} from 'primeng/divider';
import { DurationPipe } from '../../../../core/pipes/duration.pipe';
import {ACTIVITY_TYPE_META} from '../../../../core/constants/activity.constants';

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
