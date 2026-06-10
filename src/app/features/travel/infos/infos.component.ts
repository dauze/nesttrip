import {Component, inject, input, ChangeDetectionStrategy, signal, effect, computed} from '@angular/core';
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
      if (event.previousIndex === event.currentIndex) return; // early exit utile
    const items = [...this.items()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.travelStore.reorderItems(this.tripId(), items.map(a => a.id));
  }

  addItem(): void {
    const newItem: Item = {
      id: crypto.getRandomValues(new Uint32Array(1))[0],
      title: '',
      type: this.InfoType.TODO,
      elements: []
    };
    this.travelStore.createItem(this.tripId(), newItem);
    this.focusTitleWithRetry(newItem.id);
  }

  addPoint(item: Item): void {
    const elements = [...item.elements];
    elements.push(this.newPoint('', false));
    this.updateElements(item, elements);
    this.focusRow(item.id, elements.length - 1, 0);
  }

  removePoint(item: Item, index: number): void {
    const elements = [...item.elements];
    elements.splice(index, 1);
    this.updateElements(item, elements);
  }

  confirmDelete(item: Item): void {
    this.confirmationService.confirm({
      message: 'Supprimer cet élément ?',
      accept: () => {
        this.travelStore.removeItem(this.tripId(), item.id)
      }
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
    const current = this.items().find(i => i.id === item.id)!;
    const elements = current.elements.map((p, i) => i === index ? { ...p, text: value } : p);
    this.updateElements(item, elements);
  }

  toggleCheck(item: Item, index: number): void {
      const current = this.items().find(i => i.id === item.id)!;
      const point = current.elements[index];
      const newChecked = !point.checked;
      const updated = { ...point, checked: newChecked };

      let elements: Point[];
      if (newChecked) {
        // Déplace en fin de liste
        elements = [
          ...current.elements.filter((_, i) => i !== index),
          updated
        ];
      } else {
        // Déplace en début de liste
        elements = [
          updated,
          ...current.elements.filter((_, i) => i !== index),

        ];
      }

      this.updateElements(item, elements);
    }

  onEnterRow(item: Item, index: number, event: KeyboardEvent): void {
    event.preventDefault();

    const el = event.target as HTMLTextAreaElement;
    const cursor = el.selectionStart ?? 0;
    const current = this.items().find(i => i.id === item.id)!;

    const before = current.elements[index].text.substring(0, cursor);
    const after  = current.elements[index].text.substring(cursor);
    el.value = before;

    const elements = [...current.elements];
    elements[index] = { ...elements[index], text: before };
    elements.splice(index + 1, 0, this.newPoint(after, current.elements[index].checked));

    this.updateElements(item, elements);
    this.focusRow(item.id, index + 1, 0);
  }

  onBackspaceRow(item: Item, index: number, event: KeyboardEvent): void {
    const el = event.target as HTMLTextAreaElement;
    if ((el.selectionStart ?? 0) !== 0 || index === 0) return;

    event.preventDefault();

    const current = this.items().find(i => i.id === item.id)!;
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
    const current = this.items().find(i => i.id === item.id)!;
    const points = current.elements;

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
    else document.querySelector<HTMLElement>(`[data-title-id="${item.id}"]`)?.focus(); // 👈
  }

  onArrowDown(item: Item, index: number, event: KeyboardEvent): void {
    const current = this.items().find(i => i.id === item.id)!;
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

  onDropPoint(item: Item, event: CdkDragDrop<Point[]>): void {
    const current = this.items().find(i => i.id === item.id)!;
    const elements = [...current.elements];

    if (item.type !== InfoType.TODO) {
      moveItemInArray(elements, event.previousIndex, event.currentIndex);
      this.updateElements(item, elements);
      return;
    }

    // Seuls les unchecked sont dans la liste, on reorder directement
    const unchecked = elements.filter(p => !p.checked);
    moveItemInArray(unchecked, event.previousIndex, event.currentIndex);
    this.updateElements(item, [...unchecked, ...elements.filter(p => p.checked)]);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private newPoint(text = '', checked = false): Point {
    return { id: crypto.getRandomValues(new Uint32Array(1))[0], text, checked };
  }

  private updateElements(item: Item, elements: Point[]): void {
    this.travelStore.updateItem(this.tripId(), item.id, { elements });
  }

  private focusTitleWithRetry(itemId: number, attempts = 0): void {
    const el = document.querySelector<HTMLElement>(
      `input[data-title-id="${itemId}"], textarea[data-title-id="${itemId}"]`
    );
    if (el) { el.focus(); return; }
    if (attempts < 5) setTimeout(() => this.focusTitleWithRetry(itemId, attempts + 1), 50 * (attempts + 1));
  }
}
