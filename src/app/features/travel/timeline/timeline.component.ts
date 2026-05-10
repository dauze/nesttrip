import { Component, inject, input } from '@angular/core';
import { TimelineItem } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-timeline',
  standalone: true,
  template: `
    <div class="timeline">
      <div class="timeline-title">Vue d'ensemble de la journée</div>
      @for (item of items(); track item.time) {
        <div class="tl-row">
          <button class="btn-primary rounded-btn" (click)="deleteItem(item)">✕</button>
          <span class="tl-time" contenteditable="true"
                (blur)="updateItem(item, { time: $any($event.target).innerText.trim() })">
            {{ item.time }}
          </span>
          <div class="tl-dot {{ item.color }}"></div>
          <div class="tl-content" contenteditable="true"
              (blur)="updateItem(item, { content: $any($event.target).innerText.trim() })">
            {{ item.content }}
          </div>
        </div>
      }
      <div class="add-activity-btn-wrapper">
        <button class="btn-primary rounded-btn" (click)="addItem()">+</button>
      </div>
      
    </div>
  `,
})
export class TimelineComponent {
  private readonly travel = inject(TabService);
  readonly items = input.required<TimelineItem[]>();

  addItem(): void {
    const newItem: TimelineItem = { time: '00:00', color: 'blue', content: 'Nouvel élément' };
    this.travel.updateDayField({ timeline: [...this.items(), newItem] });
  }

  deleteItem(item: TimelineItem): void {
    this.travel.updateDayField({ timeline: this.items().filter(i => i !== item) });
  }

  updateItem(item: TimelineItem, patch: Partial<TimelineItem>): void {
    this.travel.updateDayField({
      timeline: this.items().map(i => i === item ? { ...i, ...patch } : i)
    });
  }
}
