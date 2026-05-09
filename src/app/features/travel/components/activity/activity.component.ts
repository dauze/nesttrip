import { Component, input } from '@angular/core';
import { Activity } from '../../../../core/models/travel.models';

@Component({
  selector: 'app-activity',
  standalone: true,
  template: `
    <div class="activity">
      <div class="act-header">
        <span class="act-name">{{ activity().name }}</span>
        <div class="act-badges">
          @for (badge of activity().badges; track badge.text) {
            <span class="pill {{ badge.class }}">{{ badge.text }}</span>
          }
        </div>
      </div>

      @for (item of activity().grid; track item.label) {
        <div class="act-item">
          <strong>{{ item.label }}</strong> : {{ item.value }}
        </div>
      }

      @if (activity().transport; as transport) {
        <div class="act-transport">
          <span class="act-transport-icon">{{ transport.icon }}</span>
          <span>{{ transport.text }}</span>
        </div>
      }

      @if (activity().tip) {
        <div class="act-tip">{{ activity().tip }}</div>
      }
    </div>
  `,
})
export class ActivityComponent {
  readonly activity = input.required<Activity>();
}
