import { Component, inject, input } from '@angular/core';
import { Day, DayContent } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  templateUrl: 'hero.component.html',
  styleUrl: 'hero.component.scss',
})
export class HeroComponent {
  readonly day = input.required<DayContent>();
  private readonly travel = inject(TabService);
patch(field: keyof DayContent, value: string, el: EventTarget | null): void {
  if (!el) return;
  const current = this.day()[field];
  if (value === current) return;

  (el as HTMLElement).textContent = value;
  this.travel.updateDayField({ [field]: value });
}

}
