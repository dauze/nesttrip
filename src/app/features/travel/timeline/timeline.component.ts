import { afterNextRender, Component, inject, input, signal } from '@angular/core';
import { TimelineItem } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { InitContentDirective } from '../../../shared/pipes/init-content.directive';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [SelectModule, FormsModule, NgClass, InitContentDirective],
  templateUrl: 'timeline.component.html',
  styleUrl: 'timeline.component.scss',
})
export class TimelineComponent {
  private readonly travel = inject(TabService);
  readonly items = input.required<TimelineItem[]>();

  colors: TimelineItem['color'][] = ['orange', 'blue', 'green', 'gray', 'yellow', 'red', 'purple'];

  readonly localItems = signal<TimelineItem[]>([]);
  private suppressBlur = false;

  constructor() {
    afterNextRender(() => {
      this.localItems.set(
        this.items().map(item => ({ ...item, id: item.id ?? crypto.randomUUID() }))
      );
    });
  }

  // --- Lecture locale (input) ---

  onTimeInput(id: string, value: string): void {
    this.localItems.update(items =>
      items.map(i => i.id === id ? { ...i, time: value } : i)
    );
  }

  onContentInput(id: string, value: string): void {
    this.localItems.update(items =>
      items.map(i => i.id === id ? { ...i, content: value } : i)
    );
  }

  // --- Persist au blur ---
    persistItem(id: string): void {
      if (this.suppressBlur) return;
      // Lit directement depuis le DOM
      const rows = document.querySelectorAll<HTMLElement>('.tl-row');
      const updated = this.localItems().map((item, i) => {
        if (item.id !== id) return item;
        const row = rows[i];
        const time = row?.querySelector<HTMLElement>('.tl-time')?.innerText.trim() ?? item.time;
        const content = row?.querySelector<HTMLElement>('.tl-content')?.innerText.trim() ?? item.content;
        return { ...item, time, content };
      });
      this.localItems.set(updated);
      this.travel.updateDayField({ timeline: updated });
    }

  // --- Couleur (persist immédiat car via select) ---

  onColorChange(id: string, color: unknown): void {
    this.localItems.update(items =>
      items.map(i => i.id === id ? { ...i, color: color as TimelineItem['color'] } : i)
    );
    this.travel.updateDayField({ timeline: this.localItems() });
  }

  // --- Clavier ---

  onEnter(event: KeyboardEvent, id: string): void {
    event.preventDefault();
    const items = [...this.localItems()];
    const index = items.findIndex(i => i.id === id);
    const newItem: TimelineItem = { id: crypto.randomUUID(), time: '00:00', color: 'blue', content: '' };
    items.splice(index + 1, 0, newItem);
    this.localItems.set(items);
    this.travel.updateDayField({ timeline: items });
    requestAnimationFrame(() => this.focusContent(index + 1));
  }

  onBackspace(event: KeyboardEvent, id: string): void {
    const el = event.target as HTMLElement;
    if (el.innerText.trim() !== '') return;

    event.preventDefault();
    const items = this.localItems();
    if (items.length === 1) return;

    const index = items.findIndex(i => i.id === id);
    this.suppressBlur = true;
    const updated = items.filter(i => i.id !== id);
    this.localItems.set(updated);
    this.travel.updateDayField({ timeline: updated });
    requestAnimationFrame(() => {
      this.focusContent(index - 1);
      this.suppressBlur = false;
    });
  }

  private focusContent(index: number): void {
    const contents = document.querySelectorAll<HTMLElement>('.tl-content');
    const target = contents[index];
    if (!target) return;
    target.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(target);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}