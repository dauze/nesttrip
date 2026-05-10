import { Component, ElementRef, inject, input, ViewChild } from '@angular/core';
import { TimelineItem } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-timeline',
  standalone: true,
  templateUrl: 'timeline.component.html',
})
export class TimelineComponent {
  private readonly travel = inject(TabService);
  readonly items = input.required<TimelineItem[]>();
  @ViewChild('listRef') listRef!: ElementRef<HTMLElement>;

  onEnter(event: KeyboardEvent, index: number): void {
    event.preventDefault();
    const newItem: TimelineItem = { time: '00:00', color: 'blue', content: '' };
    const items = [...this.items()];
    items.splice(index + 1, 0, newItem);
    this.travel.updateDayField({ timeline: items });

    setTimeout(() => this.focusContent(index + 1));
  }

  onBackspace(event: KeyboardEvent, index: number): void {
    const el = event.target as HTMLElement;
    if (el.innerText.trim() !== '') return;

    event.preventDefault();
    if (this.items().length === 1) return;

    this.travel.updateDayField({
      timeline: this.items().filter((_, i) => i !== index)
    });

    setTimeout(() => this.focusContent(index - 1));
  }

  private focusContent(index: number): void {
    const contents = document.querySelectorAll('.tl-content');
    const target = contents[index] as HTMLElement;
    if (!target) return;
    target.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(target);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  updateItem(item: TimelineItem, patch: Partial<TimelineItem>): void {
    this.travel.updateDayField({
      timeline: this.items().map(i => i === item ? { ...i, ...patch } : i)
    });
  }
}
