import { Component, input } from '@angular/core';
import { Alerts } from '../../../core/models/travel.models';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-alert-box',
  standalone: true,
  imports: [SafeHtmlPipe],
  template: `
    <div class="alert-box">
      <h3>{{ alerts().title }}</h3>
      <ul>
        @for (point of alerts().points; track $index) {
          <li [innerHTML]="point | safeHtml"></li>
        }
      </ul>
    </div>
  `,
})
export class AlertBoxComponent {
  readonly alerts = input.required<Alerts>();
}
