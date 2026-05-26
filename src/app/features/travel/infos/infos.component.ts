import { Component, inject, input, ViewChildren, QueryList, HostListener, ChangeDetectionStrategy, signal, effect } from '@angular/core';
import { Info, Item, Point } from '../../../core/models/firebase/info.models';
import { InfoType } from '../../../core/enums/infos.type';
import { InfoService } from '../../../core/services/info.service';
import { PanelModule } from 'primeng/panel';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule, Textarea } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-infos',
  standalone: true,
  imports: [PanelModule, InputTextModule, CheckboxModule, TextareaModule, FormsModule, ButtonModule, DragDropModule],
  templateUrl: './infos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfosComponent {
  private readonly infosService = inject(InfoService);
  readonly info = input.required<Info>();
  readonly tripId = input.required<number>();
  readonly InfoType = InfoType;

  @ViewChildren(Textarea) pTextareas!: QueryList<Textarea>;

  private debounceTimer: any;
  readonly localItems = signal<Item[]>([]);

  constructor() {
    // Synchronisation de l'input vers le state local si aucun debounce n'est actif
    effect(() => {
      const items = this.info().items.map(item => ({
        ...item,
        elements: (item.elements || []).map((p: any) => 
          typeof p === 'string' ? { text: p, checked: false } : p
        )
      }));
      
      if (!this.debounceTimer) {
        this.localItems.set(items.length ? items : []);
      }
    });
  }

  onDrop(event: CdkDragDrop<Item[]>): void {
    const itemsCopy = [...this.localItems()];
    moveItemInArray(itemsCopy, event.previousIndex, event.currentIndex);
    this.localItems.set(itemsCopy);
    this.infosService.reorderItems(this.tripId(), itemsCopy).subscribe();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.pTextareas) {
      this.pTextareas.forEach(textarea => textarea.resize());
    }
  }

  addItem(): void {
  const newItem: Item = {
    id: crypto.getRandomValues(new Uint32Array(1))[0],
    title: '',
    type: this.InfoType.TODO, // Utilisation de l'enum de la classe
    elements: [{ text: '', checked: false }]
  };

  // 1. Mise à jour immédiate de l'interface (Optimistic UI)
  this.localItems.set([...this.localItems(), newItem]);

  // 2. Envoi en tâche de fond à Firebase
  this.infosService.createItem(this.tripId(), newItem).subscribe({
    error: (err) => {
      // Optionnel : Si Firebase échoue, on retire l'item pour éviter les désynchronisations
      this.localItems.set(this.localItems().filter(i => i.id !== newItem.id));
      console.error("Erreur lors de la création de l'item", err);
    }
  });

  // 3. Focus automatique sur le titre du nouvel item créé
  requestAnimationFrame(() => {
    const titleEl = document.querySelector<HTMLInputElement>(`input[data-title-id="${newItem.id}"]`);
    titleEl?.focus();
  });
}

  private triggerRemoteUpdate(item: Item, elements: Point[]): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.infosService.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe(() => {
        this.debounceTimer = null;
      });
    }, 1000);
  }

  onTextChange(item: Item, index: number, value: string): void {
    const updatedItems = this.localItems().map(i => {
      if (i.id === item.id) {
        const elements = i.elements.map((p, idx) => idx === index ? { ...p, text: value } : p);
        return { ...i, elements };
      }
      return i;
    });
    
    this.localItems.set(updatedItems);
    this.adjustCurrentTextareaSize(item.id, index);

    const targetItem = updatedItems.find(i => i.id === item.id);
    if (targetItem) {
      this.triggerRemoteUpdate(item, targetItem.elements);
    }
  }

  onEnterRow(item: Item, index: number, event: KeyboardEvent): void {
    event.preventDefault();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const textareaEl = event.target as HTMLTextAreaElement;
    const selectionStart = textareaEl.selectionStart ?? 0;
    
    const currentItem = this.localItems().find(i => i.id === item.id);
    if (!currentItem) return;

    const currentPoints = currentItem.elements;
    const currentText = currentPoints[index].text;

    const textRemaining = currentText.substring(0, selectionStart);
    const textDescending = currentText.substring(selectionStart);

    textareaEl.value = textRemaining;
    this.adjustCurrentTextareaSize(item.id, index);

    const elements = [...currentPoints];
    elements[index] = { ...elements[index], text: textRemaining };
    elements.splice(index + 1, 0, { text: textDescending, checked: false });

    this.localItems.set(
      this.localItems().map(i => i.id === item.id ? { ...i, elements } : i)
    );

    this.infosService.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();

    requestAnimationFrame(() => {
      this.focusRow(item.id, index + 1, 0);
    });
  }

  focusRow(itemId: number, index: number, cursorPosition: number): void {
    const getEl = () => document.querySelector<HTMLTextAreaElement>(`textarea[data-item-id="${itemId}"][data-index="${index}"]`);
    let textareaEl = getEl();
    
    if (textareaEl) {
      textareaEl.focus();
      textareaEl.setSelectionRange(cursorPosition, cursorPosition);
      this.adjustCurrentTextareaSize(itemId, index);
    } else {
      setTimeout(() => {
        textareaEl = getEl();
        if (textareaEl) {
          textareaEl.focus();
          textareaEl.setSelectionRange(cursorPosition, cursorPosition);
          this.adjustCurrentTextareaSize(itemId, index);
        }
      }, 10);
    }
  }

  onBackspaceRow(item: Item, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const selectionStart = textareaEl.selectionStart ?? 0;

    if (selectionStart !== 0 || index === 0) return;
    
    event.preventDefault();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const currentItem = this.localItems().find(i => i.id === item.id);
    if (!currentItem) return;

    const currentPoints = currentItem.elements;
    const textToMoveUp = currentPoints[index].text;
    const upperLineText = currentPoints[index - 1].text;
    const targetCursorPosition = upperLineText.length;

    const upperTextareaEl = document.querySelector<HTMLTextAreaElement>(`textarea[data-item-id="${item.id}"][data-index="${index - 1}"]`);

    if (upperTextareaEl) {
      upperTextareaEl.value = upperLineText + textToMoveUp;
      upperTextareaEl.focus();
      upperTextareaEl.setSelectionRange(targetCursorPosition, targetCursorPosition);
      this.adjustCurrentTextareaSize(item.id, index - 1);
    }

    const elements = currentPoints
      .map((p, i) => i === index - 1 ? { ...p, text: upperLineText + textToMoveUp } : p)
      .filter((_, i) => i !== index);

    this.localItems.set(
      this.localItems().map(i => i.id === item.id ? { ...i, elements } : i)
    );

    this.infosService.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
  }

  onArrowUp(item: Item, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    if (index > 0) {
      event.preventDefault();
      this.focusRow(item.id, index - 1, textareaEl.selectionStart ?? 0);
    } else {
      event.preventDefault();
      document.querySelector<HTMLInputElement>(`input[data-title-id="${item.id}"]`)?.focus();
    }
  }

  onArrowDown(item: Item, index: number, event: KeyboardEvent): void {
    const currentItem = this.localItems().find(i => i.id === item.id);
    if (currentItem && index < currentItem.elements.length - 1) {
      event.preventDefault();
      this.focusRow(item.id, index + 1, (event.target as HTMLTextAreaElement).selectionStart ?? 0);
    }
  }

  toggleCheck(item: Item, index: number): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const currentItem = this.localItems().find(i => i.id === item.id);
    if (!currentItem) return;

    const elements = currentItem.elements.map((p, i) => i === index ? { ...p, checked: !p.checked } : p);

    this.localItems.set(
      this.localItems().map(i => i.id === item.id ? { ...i, elements } : i)
    );

    this.infosService.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
  }

  onDeleteRow(item: Item, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const selectionStart = textareaEl.selectionStart ?? 0;
    const textLength = textareaEl.value.length;

    const currentItem = this.localItems().find(i => i.id === item.id);
    if (!currentItem) return;

    const currentPoints = currentItem.elements;
    const totalRows = currentPoints.length;

    if (textLength === 0 && totalRows > 1) {
      event.preventDefault();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      const elements = currentPoints.filter((_, i) => i !== index);

      this.localItems.set(
        this.localItems().map(i => i.id === item.id ? { ...i, elements } : i)
      );

      this.infosService.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();

      const nextIndex = index < elements.length ? index : index - 1;
      setTimeout(() => this.focusRow(item.id, nextIndex, 0), 0);
      return;
    }

    if (selectionStart === textLength && index < totalRows - 1) {
      event.preventDefault();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      const currentText = currentPoints[index].text;
      const lowerLineText = currentPoints[index + 1].text;

      textareaEl.value = currentText + lowerLineText;
      textareaEl.setSelectionRange(selectionStart, selectionStart);
      this.adjustCurrentTextareaSize(item.id, index);

      const elements = currentPoints
        .map((p, i) => i === index ? { ...p, text: currentText + lowerLineText } : p)
        .filter((_, i) => i !== index + 1);

      this.localItems.set(
        this.localItems().map(i => i.id === item.id ? { ...i, elements } : i)
      );

      this.infosService.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
    }
  }

  updateTitle(item: Item, title: string): void {
    this.infosService.updateItem(this.tripId(), item.id, { title }, this.info()).subscribe();
  }

  private adjustCurrentTextareaSize(itemId: number, index: number): void {
    requestAnimationFrame(() => {
      const targetTextarea = this.pTextareas.find(t => 
        t.el.nativeElement.getAttribute('data-item-id') === String(itemId) &&
        t.el.nativeElement.getAttribute('data-index') === String(index)
      );
      targetTextarea?.resize();
    });
  }
}