import {Component, inject, input, ChangeDetectionStrategy, computed, signal} from '@angular/core';
import { PanelModule } from 'primeng/panel';
import { Textarea } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Fieldset } from 'primeng/fieldset';
import { Checkbox } from 'primeng/checkbox';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import { ConfirmationService } from 'primeng/api';
import {InfoType} from '@core/enums/infos.type';
import {Info, Item, Point} from './info.models';
import { AutoResizeFixDirective } from '../../../shared/pipes/auto-resize-area.pipe';
import { TravelStore } from '../travel.service';


@Component({
  selector: 'app-infos',
  standalone: true,
  imports: [PanelModule, Textarea, FormsModule, Checkbox, Button, DragDropModule, Fieldset, AutoResizeFixDirective],
  templateUrl: './infos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfosComponent {
  private readonly travelStore = inject(TravelStore);
  private readonly confirmationService = inject(ConfirmationService);

  readonly info = input.required<Info>();
  readonly tripId = input.required<number>();
  readonly InfoType = InfoType;
  readonly items = computed(() => this.travelStore.getInfoItems(this.tripId())());
  readonly activePointId = signal<number | null>(null);

  // ─── Events ─────────────────────────────────────────────────────────────────
  onDrop(event: CdkDragDrop<Item[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const items = [...this.items()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.travelStore.reorderItems(this.tripId(), items.map(a => a.id));
  }

  addItem(): void {
   const newItem: Item = {
      id: crypto.getRandomValues(new Uint32Array(1))[0],
      title: '',
      type: InfoType.TODO,
      elements: []
    };
    this.travelStore.createItem(this.tripId(), newItem);
  }

  addPoint(item: Item): void {
    const elements = [...item.elements, this.newPoint()];
    this.updateElements(item, elements);
    this.focusRow(item.id, elements.length - 1, 0);
  }

  removePoint(item: Item, index: number): void {
    this.updateElements(item, item.elements.filter((_, i) => i !== index));
  }

  confirmDelete(item: Item): void {
    this.confirmationService.confirm({
      message: 'Supprimer cet élément ?',
      accept: () => this.travelStore.removeItem(this.tripId(), item.id)
    });
  }

  toggleType(item: Item): void {
    const type = item.type === InfoType.TODO ? InfoType.INFO : InfoType.TODO;
    this.travelStore.updateItem(this.tripId(), item.id, { type });
  }

  updateTitle(item: Item, title: string): void {
    this.travelStore.updateItem(this.tripId(), item.id, { title });
  }

  onTextChange(item: Item, index: number, value: string): void {
    const elements = item.elements.map((p, i) => i === index ? { ...p, text: value } : p);
    this.updateElements(item, elements);
  }

  toggleCheck(item: Item, index: number): void {
    const point = item.elements[index];
    const updated = { ...point, checked: !point.checked };
    const rest = item.elements.filter((_, i) => i !== index);
    // checked → fin de liste, unchecked → début
    const elements = updated.checked ? [...rest, updated] : [updated, ...rest];
    this.updateElements(item, elements);
  }

  onEnterRow(item: Item, index: number, event: KeyboardEvent): void {
    event.preventDefault();
    const el = event.target as HTMLTextAreaElement;
    const cursor = el.selectionStart ?? 0;
    const before = item.elements[index].text.substring(0, cursor);
    const after  = item.elements[index].text.substring(cursor);
    el.value = before;

    const elements = [...item.elements];
    elements[index] = { ...elements[index], text: before };
    elements.splice(index + 1, 0, this.newPoint(after, item.elements[index].checked));
    this.updateElements(item, elements);
    this.focusRow(item.id, index + 1, 0);
  }

  onBackspaceRow(item: Item, index: number, event: KeyboardEvent): void {
    const el = event.target as HTMLTextAreaElement;
    if ((el.selectionStart ?? 0) !== 0 || index === 0) return;
    event.preventDefault();

    const upper = item.elements[index - 1].text;
    const merged = upper + item.elements[index].text;
    const cursor = upper.length;

    const upperEl = document.querySelector<HTMLTextAreaElement>(
      `textarea[data-item-id="${item.id}"][data-index="${index - 1}"]`
    );
    if (upperEl) { upperEl.value = merged; upperEl.focus(); upperEl.setSelectionRange(cursor, cursor); }

    const elements = item.elements
      .map((p, i) => i === index - 1 ? { ...p, text: merged } : p)
      .filter((_, i) => i !== index);
    this.updateElements(item, elements);
  }

  onDeleteRow(item: Item, index: number, event: KeyboardEvent): void {
    const el = event.target as HTMLTextAreaElement;
    const points = item.elements;

    if (el.value.length === 0 && points.length > 1) {
      event.preventDefault();
      const elements = points.filter((_, i) => i !== index);
      this.updateElements(item, elements);
      setTimeout(() => this.focusRow(item.id, Math.min(index, elements.length - 1), 0), 0);
      return;
    }

    const cursor = el.selectionStart ?? 0;
    if (cursor === el.value.length && index < points.length - 1) {
      event.preventDefault();
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
    else document.querySelector<HTMLElement>(`[data-title-id="${item.id}"]`)?.focus();
  }

  onArrowDown(item: Item, index: number, event: KeyboardEvent): void {
    if (index < item.elements.length - 1) {
      event.preventDefault();
      this.focusRow(item.id, index + 1, (event.target as HTMLTextAreaElement).selectionStart ?? 0);
    }
  }

  onDropPoint(item: Item, event: CdkDragDrop<Point[]>): void {
    if (item.type !== InfoType.TODO) {
      const elements = [...item.elements];
      moveItemInArray(elements, event.previousIndex, event.currentIndex);
      this.updateElements(item, elements);
      return;
    }

    // Les indices du drag event sont relatifs aux unchecked uniquement
    const unchecked = item.elements.filter(p => !p.checked);
    const checked   = item.elements.filter(p => p.checked);
    moveItemInArray(unchecked, event.previousIndex, event.currentIndex);
    this.updateElements(item, [...unchecked, ...checked]);
  }

  focusRow(itemId: number, index: number, cursor: number): void {
    const selector = `textarea[data-item-id="${itemId}"][data-index="${index}"]`;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(selector);
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  private newPoint(text = '', checked = false): Point {
    return { id: crypto.getRandomValues(new Uint32Array(1))[0], text, checked };
  }

  private updateElements(item: Item, elements: Point[]): void {
    this.travelStore.updateItem(this.tripId(), item.id, { elements });
  }
}