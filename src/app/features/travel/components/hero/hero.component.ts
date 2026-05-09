import { Component, input } from '@angular/core';
import { DayContent } from '../../../../core/models/travel.models';

@Component({
  selector: 'app-hero',
  standalone: true,
  template: `
    <div class="day-hero">
      <div class="day-hero-title">
        {{ day().title }}
        @for (badge of day().badges; track badge.text) {
          <span class="badge {{ badge.class }}">{{ badge.text }}</span>
        }
      </div>
      <div class="day-hero-sub">{{ day().subtitle }}</div>
    </div>
  `,
})
export class HeroComponent {
  readonly day = input.required<DayContent>();
}
