import { Component, inject, input } from '@angular/core';
import { Day, DayContent } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  template: `
    <div class="day-hero">
      <div class="day-hero-title">
         <span contenteditable="true"
          (blur)="patch({ title: $any($event.target).innerText.trim() })">
        {{ day().title }}
        </span>
        @for (badge of day().badges; track badge.text) {
          <span class="badge {{ badge.class }}">{{ badge.text }}</span>
        }
      </div>
      <div class="day-hero-sub"
          contenteditable="true"
          (blur)="patch({ subtitle: $any($event.target).innerText.trim() })">
        {{ day().subtitle }}
      </div>
    </div>
  `,
})
export class HeroComponent {
  readonly day = input.required<DayContent>();
  private readonly travel = inject(TabService);
  patch(partial: Partial<DayContent>): void {
    this.travel.updateDayField(partial);
  }

}
