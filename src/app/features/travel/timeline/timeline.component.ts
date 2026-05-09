import { Component, input } from '@angular/core';
import { TimelineItem } from '../../../core/models/travel.models';

@Component({
  selector: 'app-timeline',
  standalone: true,
  template: `
    <div class="timeline">
      <div class="timeline-title">Vue d'ensemble de la journée</div>
      @for (item of items(); track item.time) {
        <div class="tl-row">
          <span class="tl-time">{{ item.time }}</span>
          <div class="tl-dot {{ item.color }}"></div>
          <div class="tl-content">{{ item.content }}</div>
        </div>
      }
    </div>
  `,
})
export class TimelineComponent {
  readonly items = input.required<TimelineItem[]>();
}
