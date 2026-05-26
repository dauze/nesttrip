import { Component, inject, input, ViewChildren, QueryList, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { Info, Item, Point } from '../../../core/models/firebase/info.models';
import { InfoType } from '../../../core/enums/infos.type';
import { InfoService } from '../../../core/services/info.service';
import { PanelModule } from 'primeng/panel';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule, Textarea } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-infos',
  standalone: true,
  imports: [PanelModule, InputTextModule, CheckboxModule, TextareaModule, FormsModule],
  templateUrl: './infos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfosComponent {
  private readonly infos = inject(InfoService);
  readonly info = input.required<Info>();
  readonly tripId = input.required<number>();
  readonly InfoType = InfoType;

  @ViewChildren(Textarea) pTextareas!: QueryList<Textarea>;

  private debounceTimer: any;

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.pTextareas) {
      this.pTextareas.forEach(textarea => textarea.resize());
    }
  }

  getItems(item: Item): Point[] {
    const raw = item.elements || [];
    if (raw.length === 0) return [{ text: '', checked: false }];
    return raw.map((p: any) => 
      typeof p === 'string' ? { text: p, checked: false } : p
    );
  }

  onTextChange(item: Item, index: number, value: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const elements = this.getItems(item).map((p, i) =>
      i === index ? { ...p, text: value } : p
    );

    this.adjustCurrentTextareaSize(item.id, index);

    this.debounceTimer = setTimeout(() => {
      this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
    }, 300);
  }

  /**
   * TOUCHE ENTRÉE : Changement de ligne instantané en parallèle de la sauvegarde
   */
  onEnterRow(item: Item, index: number, event: KeyboardEvent): void {
    event.preventDefault();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const textareaEl = event.target as HTMLTextAreaElement;
    const selectionStart = textareaEl.selectionStart ?? 0;
    
    const currentPoints = this.getItems(item);
    const currentText = currentPoints[index].text;

    const textRemaining = currentText.substring(0, selectionStart);
    const textDescending = currentText.substring(selectionStart);

    const elements = [...currentPoints];
    elements[index] = { ...elements[index], text: textRemaining };
    elements.splice(index + 1, 0, { text: textDescending, checked: false });

    // 1. On lance la sauvegarde en tâche de fond (Fire and Forget)
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();

    // 2. On bouge le curseur INSTANTANÉMENT sans attendre la réponse HTTP
    // Un simple setTimeout à 0 permet juste de laisser Angular re-rendre le template HTML
    setTimeout(() => this.focusRow(item.id, index + 1, 0));
  }

  /**
   * TOUCHE SUPPR : Fusion des lignes instantanée en parallèle
   */
  onBackspaceRow(item: Item, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const selectionStart = textareaEl.selectionStart ?? 0;

    if (selectionStart !== 0 || index === 0) return;
    
    event.preventDefault();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const currentPoints = this.getItems(item);
    const textToMoveUp = currentPoints[index].text;
    const upperLineText = currentPoints[index - 1].text;
    const targetCursorPosition = upperLineText.length;

    const elements = currentPoints
      .map((p, i) => i === index - 1 ? { ...p, text: upperLineText + textToMoveUp } : p)
      .filter((_, i) => i !== index);

    // 1. On envoie les données à Firebase en tâche de fond
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();

    // 2. On remonte le curseur IMMEDIATEMENT
    setTimeout(() => this.focusRow(item.id, index - 1, targetCursorPosition));
  }

  onArrowUp(item: Item, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const cursorPosition = textareaEl.selectionStart ?? 0;

    if (index > 0) {
      event.preventDefault();
      this.focusRow(item.id, index - 1, cursorPosition);
    } else {
      event.preventDefault();
      const titleEl = document.querySelector<HTMLInputElement>(`input[data-title-id="${item.id}"]`);
      titleEl?.focus();
    }
  }

  onArrowDown(item: Item, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const cursorPosition = textareaEl.selectionStart ?? 0;
    const totalRows = this.getItems(item).length;

    if (index < totalRows - 1) {
      event.preventDefault();
      this.focusRow(item.id, index + 1, cursorPosition);
    }
  }

  toggleCheck(item: Item, index: number): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const elements = this.getItems(item).map((p, i) =>
      i === index ? { ...p, checked: !p.checked } : p
    );
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
  }

  updateTitle(item: Item, title: string): void {
    this.infos.updateItem(this.tripId(), item.id, { title }, this.info()).subscribe();
  }

  focusRow(itemId: number, index: number, cursorPosition: number): void {
    const textareaEl = document.querySelector<HTMLTextAreaElement>(
      `textarea[data-item-id="${itemId}"][data-index="${index}"]`
    );
    
    if (textareaEl) {
      textareaEl.focus();
      setTimeout(() => {
        textareaEl.setSelectionRange(cursorPosition, cursorPosition);
        this.adjustCurrentTextareaSize(itemId, index);
      });
    }
  }

  private adjustCurrentTextareaSize(itemId: number, index: number): void {
    const targetTextarea = this.pTextareas.find(t => 
      t.el.nativeElement.getAttribute('data-item-id') === String(itemId) &&
      t.el.nativeElement.getAttribute('data-index') === String(index)
    );

    if (targetTextarea) {
      targetTextarea.resize();
    }
  }
}