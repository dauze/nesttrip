import { Component, effect, ElementRef, inject, input, signal, ViewChild } from '@angular/core';
import { Info, Item, Point } from '../../../core/models/firebase/info.models';
import { InfoType } from '../../../core/enums/infos.type';
import { InfoService } from '../../../core/services/info.service';
import { PanelModule } from 'primeng/panel';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-infos',
  standalone: true,
  imports: [PanelModule, CheckboxModule, FormsModule, InputTextModule],
  templateUrl: 'infos.component.html',
  styleUrl: 'infos.component.scss'
})
export class InfosComponent {
  private readonly infos = inject(InfoService);
  readonly info = input.required<Info>();
  readonly tripId = input.required<number>();  // string pour matcher les signatures du service

  readonly InfoType = InfoType;

  // Map itemId → Point[] pour ne pas recalculer à chaque fois
  private readonly todoItemsMap = signal<Record<number, Point[]>>({});

  @ViewChild('listRef') listRef!: ElementRef<HTMLUListElement>;

  constructor() {
    effect(() => {
      const map: Record<number, Point[]> = {};
      for (const item of this.info().items) {
        const raw = item.elements;
        map[item.id] = !raw?.length
          ? [{ text: '', checked: false }]
          : raw.map((p: any) =>
              typeof p === 'string' ? { text: p, checked: false } : p
            );
      }
      this.todoItemsMap.set(map);
    });
  }

  // Accesseurs par item
  todoItems(itemId: number): Point[] {
    return this.todoItemsMap()[itemId] ?? [];
  }

  stringItems(item: Item): string[] {
    return (item.elements as any[]).map(e =>
      typeof e === 'string' ? e : e.text
    );
  }

  // ── TODO ──────────────────────────────────────────────────────────────

  toggleCheck(item: Item, index: number): void {
    const elements = this.todoItems(item.id).map((p, i) =>
      i === index ? { ...p, checked: !p.checked } : p
    );
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
  }

  onTextChange(item: Item, index: number, value: string): void {
    const elements = this.todoItems(item.id).map((p, i) =>
      i === index ? { ...p, text: value } : p
    );
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
  }

  onEnterTodo(item: Item, index: number, event: Event): void {
    event.preventDefault();
    const current = this.todoItems(item.id);
    const elements = [
      ...current.slice(0, index + 1),
      { text: '', checked: false },
      ...current.slice(index + 1),
    ];
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe(() => {
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.todo-input');
        inputs[index + 1]?.focus();
      });
    });
  }

  onBackspaceTodo(item: Item, index: number, value: string, event: Event): void {
    if (value !== '' || index === 0) return;
    event.preventDefault();
    const elements = this.todoItems(item.id).filter((_, i) => i !== index);
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe(() => {
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.todo-input');
        inputs[index - 1]?.focus();
      });
    });
  }

  // ── INFO (liste ul/li) ────────────────────────────────────────────────

  updateElement(item: Item, index: number, value: string): void {
    const elements = this.stringItems(item).map((text, i) =>
      i === index ? { text, checked: false } : { text: this.stringItems(item)[i], checked: false }
    );
    // On reconstruit proprement en Point[]
    const points: Point[] = this.stringItems(item).map((text, i) =>
      ({ text: i === index ? value : text, checked: false })
    );
    this.infos.updateItem(this.tripId(), item.id, { elements: points }, this.info()).subscribe();
  }

  onEnter(item: Item, event: KeyboardEvent, index: number): void {
    event.preventDefault();
    const items = [...this.stringItems(item)];
    items.splice(index + 1, 0, '');
    const elements: Point[] = items.map(text => ({ text, checked: false }));
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe(() => {
      setTimeout(() => this.focusItem(index + 1));
    });
  }

  onBackspace(item: Item, event: KeyboardEvent, index: number): void {
    const el = event.target as HTMLElement;
    if (el.innerText.trim() !== '') return;
    event.preventDefault();
    const strings = this.stringItems(item);
    if (strings.length === 1) return;
    const elements: Point[] = strings
      .filter((_, i) => i !== index)
      .map(text => ({ text, checked: false }));
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe(() => {
      setTimeout(() => this.focusItem(index - 1));
    });
  }

  // ── Titre ─────────────────────────────────────────────────────────────

  updateTitle(item: Item, title: string): void {
    this.infos.updateItem(this.tripId(), item.id, { title }, this.info()).subscribe();
  }

  // ── Utilitaires ───────────────────────────────────────────────────────

  private focusItem(index: number): void {
    const items = this.listRef.nativeElement.querySelectorAll('li');
    const target = items[index] as HTMLElement;
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