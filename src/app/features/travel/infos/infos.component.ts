import { Component, inject, input, ChangeDetectionStrategy, signal, effect } from '@angular/core';
import { Info, Item, Point } from '../../../core/models/firebase/info.models';
import { InfoType } from '../../../core/enums/infos.type';
import { InfoService } from '../../../core/services/info.service';
import { PanelModule } from 'primeng/panel';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AutoResizeFixDirective } from '../../../core/pipes/auto-resize-area.pipe';

@Component({
  selector: 'app-infos',
  standalone: true,
  imports: [PanelModule, InputTextModule, TextareaModule, FormsModule, Checkbox, ButtonModule, DragDropModule, AutoResizeFixDirective],
  templateUrl: './infos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfosComponent {
  private readonly infosService = inject(InfoService);
  readonly info = input.required<Info>();
  readonly tripId = input.required<number>();
  readonly InfoType = InfoType;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private skipNextEffect = false;
  readonly localItems = signal<Item[]>([]);

  constructor() {
    effect(() => {
      if (!this.skipNextEffect) this.localItems.set(this.info().items);
      this.skipNextEffect = false;
    });
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  onDrop(event: CdkDragDrop<Item[]>): void {
    const items = [...this.localItems()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.localItems.set(items);
    this.infosService.reorderItems(this.tripId(), items).subscribe();
  }

  addItem(): void {
    const newItem: Item = {
      id: crypto.getRandomValues(new Uint32Array(1))[0],
      title: '',
      type: this.InfoType.TODO,
      elements: [this.newPoint()]
    };
    this.localItems.set([...this.localItems(), newItem]);
    this.infosService.createItem(this.tripId(), newItem).subscribe({
      error: () => this.localItems.set(this.localItems().filter(i => i.id !== newItem.id))
    });
    this.focusTitleWithRetry(newItem.id);
  }

  toggleType(item: Item): void {
    const type = item.type === InfoType.TODO ? InfoType.INFO : InfoType.TODO;
    this.skipNextEffect = true;
    this.localItems.set(this.localItems().map(i => i.id === item.id ? { ...i, type } : i));
    this.infosService.updateItem(this.tripId(), item.id, { type }, this.info()).subscribe({
      next: () => this.skipNextEffect = false,
      error: () => this.skipNextEffect = false
    });
  }

  updateTitle(item: Item, title: string): void {
    this.infosService.updateItem(this.tripId(), item.id, { title }, this.info()).subscribe();
  }

  onTextChange(item: Item, index: number, value: string): void {
    const current = this.localItems().find(i => i.id === item.id)!;
    const elements = current.elements.map((p, i) => i === index ? { ...p, text: value } : p);
    this.updateElements(item, elements, true);
  }

  toggleCheck(item: Item, index: number): void {
    const current = this.localItems().find(i => i.id === item.id)!;
    const elements = current.elements.map((p, i) => i === index ? { ...p, checked: !p.checked } : p);
    this.updateElements(item, elements);
  }

  onEnterRow(item: Item, index: number, event: KeyboardEvent): void {
    event.preventDefault();
    this.clearDebounce();

    const el = event.target as HTMLTextAreaElement;
    const cursor = el.selectionStart ?? 0;
    const current = this.localItems().find(i => i.id === item.id)!;

    const before = current.elements[index].text.substring(0, cursor);
    const after  = current.elements[index].text.substring(cursor);
    el.value = before;

    const elements = [...current.elements];
    elements[index] = { ...elements[index], text: before };
    elements.splice(index + 1, 0, this.newPoint(after));

    this.updateElements(item, elements);
    this.focusRow(item.id, index + 1, 0);
  }

  onBackspaceRow(item: Item, index: number, event: KeyboardEvent): void {
    const el = event.target as HTMLTextAreaElement;
    if ((el.selectionStart ?? 0) !== 0 || index === 0) return;

    event.preventDefault();
    this.clearDebounce();

    const current = this.localItems().find(i => i.id === item.id)!;
    const upper = current.elements[index - 1].text;
    const merged = upper + current.elements[index].text;
    const cursor = upper.length;

    const upperEl = document.querySelector<HTMLTextAreaElement>(
      `textarea[data-item-id="${item.id}"][data-index="${index - 1}"]`
    );
    if (upperEl) { upperEl.value = merged; upperEl.focus(); upperEl.setSelectionRange(cursor, cursor); }

    const elements = current.elements
      .map((p, i) => i === index - 1 ? { ...p, text: merged } : p)
      .filter((_, i) => i !== index);

    this.updateElements(item, elements);
  }

  onDeleteRow(item: Item, index: number, event: KeyboardEvent): void {
    const el = event.target as HTMLTextAreaElement;
    const current = this.localItems().find(i => i.id === item.id)!;
    const points = current.elements;

    if (el.value.length === 0 && points.length > 1) {
      event.preventDefault();
      this.clearDebounce();
      const elements = points.filter((_, i) => i !== index);
      this.updateElements(item, elements);
      setTimeout(() => this.focusRow(item.id, Math.min(index, elements.length - 1), 0), 0);
      return;
    }

    const cursor = el.selectionStart ?? 0;
    if (cursor === el.value.length && index < points.length - 1) {
      event.preventDefault();
      this.clearDebounce();
      const merged = points[index].text + points[index + 1].text;
      el.value = merged;
      el.setSelectionRange(cursor, cursor);
      const elements = points
        .map((p, i) => i === index ? { ...p, text: merged } : p)
        .filter((_, i) => i !== index + 1);
      this.updateElements(item, elements);
    }
  }

  onArrowUp(item: Item, index: number, event: KeyboardEvent): void {
    event.preventDefault();
    if (index > 0) this.focusRow(item.id, index - 1, (event.target as HTMLTextAreaElement).selectionStart ?? 0);
    else document.querySelector<HTMLInputElement>(`input[data-title-id="${item.id}"]`)?.focus();
  }

  onArrowDown(item: Item, index: number, event: KeyboardEvent): void {
    const current = this.localItems().find(i => i.id === item.id)!;
    if (index < current.elements.length - 1) {
      event.preventDefault();
      this.focusRow(item.id, index + 1, (event.target as HTMLTextAreaElement).selectionStart ?? 0);
    }
  }

  focusRow(itemId: number, index: number, cursor: number): void {
    const selector = `textarea[data-item-id="${itemId}"][data-index="${index}"]`;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(selector);
      if (el) { el.focus(); el.setSelectionRange(cursor, cursor); }
      else setTimeout(() => {
        const el2 = document.querySelector<HTMLTextAreaElement>(selector);
        if (el2) { el2.focus(); el2.setSelectionRange(cursor, cursor); }
      }, 50);
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private newPoint(text = '', checked = false): Point {
    return { id: crypto.getRandomValues(new Uint32Array(1))[0], text, checked };
  }

  private clearDebounce(): void {
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
  }

  private updateElements(item: Item, elements: Point[], debounce = false): void {
    this.skipNextEffect = true;
    this.localItems.set(this.localItems().map(i => i.id === item.id ? { ...i, elements } : i));

    const save = () => this.infosService.updateItem(this.tripId(), item.id, { elements }, this.info())
      .subscribe({ next: () => this.skipNextEffect = false, error: () => this.skipNextEffect = false });

    if (!debounce) { save(); return; }

    this.clearDebounce();
    this.debounceTimer = setTimeout(() => { this.debounceTimer = null; save(); }, 1000);
  }

  private focusTitleWithRetry(itemId: number, attempts = 0): void {
    const el = document.querySelector<HTMLElement>(
      `input[data-title-id="${itemId}"], textarea[data-title-id="${itemId}"]`
    );
    if (el) { el.focus(); return; }
    if (attempts < 5) setTimeout(() => this.focusTitleWithRetry(itemId, attempts + 1), 50 * (attempts + 1));
  }
}