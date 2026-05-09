import { Component, inject, output } from '@angular/core';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-day-nav',
  standalone: true,
  template: `
    <nav class="day-nav">
      @for (day of service.days(); track day.id) {
        <button
          class="day-btn"
          [class.active]="service.activeDayId() === day.id"
          (click)="onSelect(day.id)"
        >
          {{ day.navLabel }}
        </button>
      }
    </nav>
  `,
})
export class DayNavComponent {
  protected readonly service = inject(TabService);

  readonly daySelected = output<string>();

  onSelect(id: string): void {
    this.service.setActiveDay(id);
    this.daySelected.emit(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
