import { Component, input } from '@angular/core';

import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { Activity } from '../../../../core/models/dto/activity.interface';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [SelectModule, FormsModule, NgClass],
  templateUrl: 'timeline.component.html',
  styleUrl: 'timeline.component.scss',
})
export class TimelineComponent {
  readonly activities = input.required<Activity[]>();
}