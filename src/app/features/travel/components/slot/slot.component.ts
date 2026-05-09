import { Component, input } from '@angular/core';
import { Slot } from '../../../../core/models/travel.models';
import { ActivityComponent } from '../activity/activity.component';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-slot',
  standalone: true,
  imports: [ActivityComponent, SafeHtmlPipe],
  template: `
    <div class="slot slot-{{ slot().type }}">
      <div class="slot-header">
        <span class="slot-icon">{{ slot().icon }}</span>
        <span class="slot-time">{{ slot().time }}</span>
        <span class="slot-name">{{ slot().name }}</span>
      </div>
      <div class="slot-body">
        @for (activity of slot().activities; track activity.name) {
          <app-activity [activity]="activity" />
        }
        @if (slot().meal) {
          <div class="meal-block" [innerHTML]="slot().meal! | safeHtml"></div>
        }
      </div>
    </div>
  `,
})
export class SlotComponent {
  readonly slot = input.required<Slot>();
}
