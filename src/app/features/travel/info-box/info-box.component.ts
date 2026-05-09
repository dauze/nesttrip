import { Component, effect, inject, input, signal } from '@angular/core';
import { InfoElement, TodoItem } from '../../../core/models/travel.models';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-info-box',
  standalone: true,
  imports: [SafeHtmlPipe],
  templateUrl: 'info-box.component.html',
  styleUrl: 'info-box.component.scss'
})
export class InfoBoxComponent {
  private readonly travel = inject(TabService);
  readonly element = input.required<InfoElement>();

  readonly todoItems = signal<TodoItem[]>([]);

  constructor() {
     effect(() => {
    // Migration depuis l'ancien format string[] si besoin
    const raw = this.element().items;
    if (!raw?.length) {
      this.todoItems.set([{ text: '', checked: false }]);
      return;
    }
    // Supporte les deux formats pendant la migration
    this.todoItems.set(
      raw.map((item: any) =>
        typeof item === 'string'
          ? { text: item, checked: false }
          : item
      )
    );
  });
  }
  onTextChange(index: number, value: string): void {
    this.todoItems.update(items =>
      items.map((item, i) => i === index ? { ...item, text: value } : item)
    );
  }

  toggleCheck(index: number): void {
    this.todoItems.update(items =>
      items.map((item, i) => i === index ? { ...item, checked: !item.checked } : item)
    );
    this.save();
  }

  onEnter(index: number, event: Event): void {
    event.preventDefault();
    this.todoItems.update(items => [
      ...items.slice(0, index + 1),
      { text: '', checked: false },
      ...items.slice(index + 1),
    ]);
    this.save();
    // Focus la ligne suivante
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.todo-input');
      inputs[index + 1]?.focus();
    });
  }

  onBackspace(index: number, value: string, event: Event): void {
    if (value !== '' || index === 0) return; // Seulement si la ligne est vide
    event.preventDefault();
    this.todoItems.update(items => items.filter((_, i) => i !== index));
    // Focus la ligne précédente
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.todo-input');
      inputs[index - 1]?.focus();
    });
    this.save();
  }

  save(): void {
    this.travel.updateElement(this.todoItems());
  }

  get stringItems(): string[] {
  return this.element().items as string[];
  }
}
