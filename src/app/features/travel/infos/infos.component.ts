import { Component, inject, input, ViewChildren, QueryList, HostListener, ChangeDetectionStrategy, signal, effect } from '@angular/core';
import { Info, Point } from '../../../core/models/firebase/info.models';
import { InfoType } from '../../../core/enums/infos.type';
import { InfoService } from '../../../core/services/info.service';
import { PanelModule } from 'primeng/panel';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule, Textarea } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-infos',
  standalone: true,
  imports: [PanelModule, InputTextModule, CheckboxModule, TextareaModule, FormsModule, ButtonModule],
  templateUrl: './infos.component.html',
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfosComponent {
  private readonly infos = inject(InfoService);
  readonly info = input.required<Info>();
  readonly tripId = input.required<number>();
  readonly InfoType = InfoType;

  @ViewChildren(Textarea) pTextareas!: QueryList<Textarea>;

  private debounceTimer: any;
  
  // La clé du succès : Un signal local modifiable instantanément
  readonly localItems = signal<any[]>([]);

  constructor() {
    // On synchronise l'input initial dans notre state local, mais UNIQUEMENT 
    // si l'utilisateur n'est pas en train de taper (pour éviter d'écraser sa saisie)
    effect(() => {
      const items = this.info().items.map(item => {
        const raw = item.elements || [];
        const points: Point[] = raw.map((p: any) => 
          typeof p === 'string' ? { text: p, checked: false } : p
        );
        return {
          ...item,
          normalizedElements: points.length === 0 ? [{ text: '', checked: false }] : points
        };
      });
      
      // On ne met à jour depuis Firebase que si aucun timer de debounce n'est actif
      if (!this.debounceTimer) {
        this.localItems.set(items);
      }
    });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.pTextareas) {
      this.pTextareas.forEach(textarea => textarea.resize());
    }
  }

    addItem(){
        this.infos.addItem(this.tripId(), this.info(),
        {
          id: crypto.getRandomValues(new Uint32Array(1))[0],
          title: '',
          type: InfoType.TODO,
          elements: [
            {
              text: '',
              checked: false
            }
          ]
        }
      ).subscribe();
      }

  /**
   * Envoi asynchrone vers Firebase sans bloquer l'interface
   */
  private triggerRemoteUpdate(item: any, elements: Point[]): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe(() => {
        this.debounceTimer = null; // Libère le verrou
      });
    }, 500); // 500ms d'inactivité de frappe
  }

  onTextChange(item: any, index: number, value: string): void {
    // 1. Mise à jour immédiate du signal local (60fps dans le DOM)
    const updatedItems = this.localItems().map(i => {
      if (i.id === item.id) {
        const normalizedElements = i.normalizedElements.map((p: any, idx: number) =>
          idx === index ? { ...p, text: value } : p
        );
        return { ...i, normalizedElements };
      }
      return i;
    });
    
    this.localItems.set(updatedItems);
    this.adjustCurrentTextareaSize(item.id, index);

    // 2. Sauvegarde distante retardée
    const targetItem = updatedItems.find(i => i.id === item.id);
    if (targetItem) {
      this.triggerRemoteUpdate(item, targetItem.normalizedElements);
    }
  }

/**
   * TOUCHE ENTRÉE au milieu d'un texte (Correction finale pour le rendu synchrone)
   */
  onEnterRow(item: any, index: number, event: KeyboardEvent): void {
    event.preventDefault();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const textareaEl = event.target as HTMLTextAreaElement;
    const selectionStart = textareaEl.selectionStart ?? 0;
    
    const currentItem = this.localItems().find(i => i.id === item.id);
    if (!currentItem) return;

    const currentPoints = currentItem.normalizedElements;
    const currentText = currentPoints[index].text;

    // Coupe du texte
    const textRemaining = currentText.substring(0, selectionStart);
    const textDescending = currentText.substring(selectionStart);

    // 1. On nettoie visuellement le textarea actuel DIRECTEMENT dans le DOM tout de suite
    textareaEl.value = textRemaining;
    this.adjustCurrentTextareaSize(item.id, index);

    // 2. On prépare les nouveaux éléments
    const elements = [...currentPoints];
    elements[index] = { ...elements[index], text: textRemaining };
    
    // On insère le nouveau point
    elements.splice(index + 1, 0, { text: textDescending, checked: false });

    // 3. On pousse dans le Signal local (Rupture de référence pour forcer le @for à s'activer)
    this.localItems.set(
      this.localItems().map(i => i.id === item.id ? { ...i, normalizedElements: [...elements] } : i)
    );

    // 4. Synchro Firebase en tâche de fond
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();

    // 5. Utilisation de requestAnimationFrame (rAF) : On attend le micro-changement de frame 
    // où le navigateur génère la nouvelle ligne, et on force le focus de manière agressive.
    requestAnimationFrame(() => {
      this.focusRow(item.id, index + 1, 0);
    });
  }

  /**
   * Fonction FocusRow mise à jour pour forcer le navigateur à obéir
   */
  focusRow(itemId: number, index: number, cursorPosition: number): void {
    // On cible le textarea grâce aux attributs HTML5 générés par le @for
    const textareaEl = document.querySelector<HTMLTextAreaElement>(
      `textarea[data-item-id="${itemId}"][data-index="${index}"]`
    );
    
    if (textareaEl) {
      textareaEl.focus();
      // On force la sélection du curseur
      textareaEl.setSelectionRange(cursorPosition, cursorPosition);
      // On force le redimensionnement immédiat de la nouvelle ligne
      this.adjustCurrentTextareaSize(itemId, index);
    } else {
      // Sécurité au cas où le DOM d'Angular a eu un micro-retard (Fréquent sur Mobile)
      setTimeout(() => {
        const retryTextarea = document.querySelector<HTMLTextAreaElement>(
          `textarea[data-item-id="${itemId}"][data-index="${index}"]`
        );
        if (retryTextarea) {
          retryTextarea.focus();
          retryTextarea.setSelectionRange(cursorPosition, cursorPosition);
          this.adjustCurrentTextareaSize(itemId, index);
        }
      }, 10);
    }
  }

/**
   * TOUCHE SUPPRIMER au début d'une zone (Zéro saut de curseur garanti)
   */
  onBackspaceRow(item: any, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const selectionStart = textareaEl.selectionStart ?? 0;

    // On ne traite que si le curseur est au tout début de la ligne (0) et qu'il y a une ligne au-dessus
    if (selectionStart !== 0 || index === 0) return;
    
    // 1. Bloque IMMÉDIATEMENT le comportement natif du navigateur
    event.preventDefault();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const currentItem = this.localItems().find(i => i.id === item.id);
    if (!currentItem) return;

    const currentPoints = currentItem.normalizedElements;
    const textToMoveUp = currentPoints[index].text;
    const upperLineText = currentPoints[index - 1].text;
    const targetCursorPosition = upperLineText.length;

    // 2. TRUC DE JEDI : On va chercher le textarea du dessus DIRECTEMENT dans le DOM
    const upperTextareaEl = document.querySelector<HTMLTextAreaElement>(
      `textarea[data-item-id="${item.id}"][data-index="${index - 1}"]`
    );

    if (upperTextareaEl) {
      // On fusionne le texte DIRECTEMENT dans l'élément HTML sans attendre Angular
      upperTextareaEl.value = upperLineText + textToMoveUp;
      
      // On le focus et on place le curseur PILE à la jonction des deux textes
      upperTextareaEl.focus();
      upperTextareaEl.setSelectionRange(targetCursorPosition, targetCursorPosition);
      
      // On force le redimensionnement immédiat pour éviter un saut visuel de hauteur
      this.adjustCurrentTextareaSize(item.id, index - 1);
    }

    // 3. MAINTENANT, on synchronise notre Signal local en tâche de fond pour Angular
    const elements = currentPoints
      .map((p: any, i: number) => i === index - 1 ? { ...p, text: upperLineText + textToMoveUp } : p)
      .filter((_: any, i: number) => i !== index);

    this.localItems.set(
      this.localItems().map(i => i.id === item.id ? { ...i, normalizedElements: [...elements] } : i)
    );

    // 4. Sauvegarde distante vers Firebase
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
  }

  onArrowUp(item: any, index: number, event: KeyboardEvent): void {
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

  onArrowDown(item: any, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const cursorPosition = textareaEl.selectionStart ?? 0;
    
    const currentItem = this.localItems().find(i => i.id === item.id);
    const totalRows = currentItem ? currentItem.normalizedElements.length : 0;

    if (index < totalRows - 1) {
      event.preventDefault();
      this.focusRow(item.id, index + 1, cursorPosition);
    }
  }

  /**
   * CHECKBOX COCHÉE : Version Synchrone Directe
   */
  toggleCheck(item: any, index: number): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const currentItem = this.localItems().find(i => i.id === item.id);
    if (!currentItem) return;

    // On inverse l'état
    const elements = currentItem.normalizedElements.map((p: any, i: number) =>
      i === index ? { ...p, checked: !p.checked } : p
    );

    // On applique le changement de référence sur le champ localItems
    this.localItems.set(
      this.localItems().map(i => i.id === item.id ? { ...i, normalizedElements: [...elements] } : i)
    );

    // Sauvegarde distante en tâche de fond (Fire & Forget)
    this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
  }

  /**
   * TOUCHE SUPPR (Delete) : Supprime si vide, ou fusionne avec la ligne d'en dessous
   */
  onDeleteRow(item: any, index: number, event: KeyboardEvent): void {
    const textareaEl = event.target as HTMLTextAreaElement;
    const selectionStart = textareaEl.selectionStart ?? 0;
    const textLength = textareaEl.value.length;

    const currentItem = this.localItems().find(i => i.id === item.id);
    if (!currentItem) return;

    const currentPoints = currentItem.normalizedElements;
    const totalRows = currentPoints.length;

    // CAS 1 : La ligne actuelle est vide (et ce n'est pas la seule ligne restante)
    if (textLength === 0 && totalRows > 1) {
      event.preventDefault();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      // On retire la ligne du tableau
      const elements = currentPoints.filter((_: any, i: number) => i !== index);

      // Update du Signal local
      this.localItems.set(
        this.localItems().map(i => i.id === item.id ? { ...i, normalizedElements: [...elements] } : i)
      );

      // Synchro Firebase
      this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();

      // On focus la ligne d'en dessous (si on a supprimé la dernière, on prend celle du dessus)
      const nextIndex = index < elements.length ? index : index - 1;
      setTimeout(() => this.focusRow(item.id, nextIndex, 0), 0);
      return;
    }

    // CAS 2 : Le curseur est à la fin du texte et il y a une ligne en dessous à aspirer
    if (selectionStart === textLength && index < totalRows - 1) {
      event.preventDefault();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      const currentText = currentPoints[index].text;
      const lowerLineText = currentPoints[index + 1].text;

      // TRUC DE JEDI : On fusionne le texte directement dans le DOM tout de suite
      textareaEl.value = currentText + lowerLineText;
      
      // On s'assure que le curseur reste là où il était (à la fin de l'ancien texte)
      textareaEl.setSelectionRange(selectionStart, selectionStart);
      this.adjustCurrentTextareaSize(item.id, index);

      // On prépare le nouveau tableau (on accole le texte du bas en haut et on vire la ligne du bas)
      const elements = currentPoints
        .map((p: any, i: number) => i === index ? { ...p, text: currentText + lowerLineText } : p)
        .filter((_: any, i: number) => i !== index + 1);

      // Update du Signal
      this.localItems.set(
        this.localItems().map(i => i.id === item.id ? { ...i, normalizedElements: [...elements] } : i)
      );

      // Synchro Firebase
      this.infos.updateItem(this.tripId(), item.id, { elements }, this.info()).subscribe();
    }
  }

  updateTitle(item: any, title: string): void {
    this.infos.updateItem(this.tripId(), item.id, { title }, this.info()).subscribe();
  }

  private adjustCurrentTextareaSize(itemId: number, index: number): void {
    // Un infime délai de rAF (requestAnimationFrame) permet d'attendre que le DOM soit stable
    requestAnimationFrame(() => {
      const targetTextarea = this.pTextareas.find(t => 
        t.el.nativeElement.getAttribute('data-item-id') === String(itemId) &&
        t.el.nativeElement.getAttribute('data-index') === String(index)
      );
      if (targetTextarea) {
        targetTextarea.resize();
      }
    });
  }
}