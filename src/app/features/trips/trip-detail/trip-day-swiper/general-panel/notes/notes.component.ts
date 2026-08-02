import {Component, DestroyRef, ViewContainerRef, inject, input, ChangeDetectionStrategy, computed, effect, signal} from '@angular/core';
import { NotesFocusService } from '@app/features/trips/trip-detail/notes-focus.service';
import { TripCreationTargetService } from '@app/features/trips/trip-detail/trip-creation-target.service';
import { DayActivityFocusService } from '@app/features/trips/trip-detail/day-activity-focus.service';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { TextareaDirective } from '@app/shared/directives/textarea.directive';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ChipComponent } from '@app/shared/components/chip/chip.component';
import { FieldsetComponent } from '@app/shared/components/fieldset/fieldset.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { SelectableDirective } from '@app/shared/directives/selectable.directive';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';
import { SelectableItemRef } from '@app/shared/services/selection-mode.service';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {Notes, Item, Point} from './notes.model';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Activity } from '@app/shared/components/activity-card/activity.model';
import { NotesType } from '@app/core/enums/notes.type';
import { CardComponent } from '@app/shared/components/card/card.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { LinkActivityDialogComponent, LinkActivityDialogData, LinkActivityDialogResult } from './link-activity-dialog/link-activity-dialog.component';

import { InputTextDirective } from '@app/shared/directives/input-text.directive';

/** Titre OU texte d'un élément quelconque de la liste (voir ROADMAP.md "UX / Interactions"). */
function matchesSearch(item: Item, term: string): boolean {
  if (item.title.toLowerCase().includes(term)) return true;
  return item.elements.some((p) => p.text.toLowerCase().includes(term));
}

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [
    PanelComponent, TextareaDirective, FormsModule, CheckboxComponent, ButtonComponent, ChipComponent,
    DragDropModule, FieldsetComponent, MessageComponent, CardComponent,
    SelectableDirective, LongPressDirective, InputTextDirective,
  ],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly notesFocusService = inject(NotesFocusService);
  private readonly fabTarget = inject(TripCreationTargetService);
  private readonly dayActivityFocusService = inject(DayActivityFocusService);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly notes = input.required<Notes>();
  readonly tripId = input.required<string>();
  readonly NotesType = NotesType;
  readonly items = computed(() => this.tripFacade.getNotesItems(this.tripId())());
  readonly activePointId = signal<string | null>(null);

  // Recherche (voir ROADMAP.md "UX / Interactions", même pattern que TripActivitiesComponent) :
  // titre OU contenu (texte de n'importe quel élément de la liste).
  readonly searchTerm = signal('');
  private readonly normalizedSearch = computed(() => this.searchTerm().trim().toLowerCase());
  readonly filteredItems = computed(() => {
    const term = this.normalizedSearch();
    if (!term) return this.items();
    return this.items().filter((item) => matchesSearch(item, term));
  });
  readonly matchCount = computed(() => this.filteredItems().length);

  constructor() {
    // "+" flottant (voir TripDetailComponent.onFabActivate) : ce tab est un
    // singleton comme un jour, donc un enregistrement one-shot au montage
    // suffit (pas d'effect, pas d'input dont dépendre).
    const unregisterFab = this.fabTarget.register('notes', () => this.addItem());
    this.destroyRef.onDestroy(unregisterFab);

    // Demande de navigation croisée (voir NotesFocusService) : entrée
    // "Liste" du menu "Ajouter" (`itemId` absent -> création) OU chip
    // "liste liée" depuis une activité (`itemId` présent -> scroll vers
    // l'item existant, voir ROADMAP.md "UX / Interactions") — consomme dès
    // que ce composant est monté (bascule de tab déjà faite par
    // TripDetailComponent, voir son effect).
    effect(() => {
      const pending = this.notesFocusService.pending();
      if (!pending) return;
      this.notesFocusService.clear(pending.token);
      if (pending.itemId) {
        this.focusItemWhenReady(pending.itemId);
      } else {
        this.addItem();
      }
    });
  }

  /** Retente sur quelques frames avant d'abandonner silencieusement — même raison que `LogisticsListComponent.focusCardWhenReady` (composant tout juste monté, la carte ciblée peut ne pas encore être dans le DOM). */
  private focusItemWhenReady(itemId: string, attemptsLeft = 15): void {
    const el = document.querySelector<HTMLElement>(`[data-title-id="${itemId}"]`);
    if (!el) {
      if (attemptsLeft <= 0) return;
      requestAnimationFrame(() => this.focusItemWhenReady(itemId, attemptsLeft - 1));
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Vue composée (jour + activité) de l'activité liée à cette liste, ou `undefined` si non liée / si l'activité a depuis été supprimée (voir `Item.linkedActivityInstanceId`, ROADMAP.md "UX / Interactions"). */
  linkedActivity(item: Item): { dayId: Date; activity: Activity } | undefined {
    if (!item.linkedActivityInstanceId) return undefined;
    return this.tripFacade.getDayActivityWithDay(this.tripId(), item.linkedActivityInstanceId)();
  }

  /** Tiroir "Lier une activité" — voir LinkActivityDialogComponent. */
  openLinkActivityDialog(item: Item): void {
    const dialogRef = this.dialogService.open<LinkActivityDialogResult | undefined, LinkActivityDialogData>(
      LinkActivityDialogComponent,
      { data: { tripId: this.tripId() }, panelClass: 'app-wide-dialog-panel', viewContainerRef: this.viewContainerRef },
    );
    dialogRef.closed.subscribe((result) => {
      if (!result) return;
      this.tripFacade.updateItem(this.tripId(), item.id, { linkedActivityInstanceId: result.instanceId });
    });
  }

  unlinkActivity(item: Item): void {
    this.tripFacade.updateItem(this.tripId(), item.id, { linkedActivityInstanceId: undefined });
  }

  /** Clic sur le chip "activité liée" : navigue vers le bon jour + activité (voir DayActivityFocusService, même mécanisme que la carte Résumé). */
  navigateToLinkedActivity(dayId: Date, instanceId: string): void {
    this.dayActivityFocusService.requestFocus(dayId.toISOString(), instanceId);
  }

  selectableRef(itemId: string): SelectableItemRef {
    return { kind: 'noteItem', id: itemId };
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  // ─── Events ─────────────────────────────────────────────────────────────────
  /** Opère sur `filteredItems()` (= `items()` quand aucune recherche n'est active) : le drag-and-drop est désactivé pendant une recherche (voir `[cdkDragDisabled]` dans le template), donc `previousIndex`/`currentIndex` restent toujours relatifs à la liste complète non filtrée dans ce cas. */
  onDrop(event: CdkDragDrop<Item[]>): void {
    // Garde-fou en plus de `[cdkDragDisabled]` (voir le template) : un drop
    // pendant une recherche active réordonnerait `filteredItems()` (un
    // sous-ensemble), et `reorderItems` REMPLACE la liste complète du trip —
    // les items masqués par le filtre seraient perdus.
    if (this.searchTerm().trim() || event.previousIndex === event.currentIndex) return;
    const items = [...this.filteredItems()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.tripFacade.reorderItems(this.tripId(), items.map(a => a.id));
  }

  /** Point d'entrée pour le "+" flottant sur ce tab, et pour l'entrée "Liste" du menu "Ajouter" depuis un jour/Résumé (voir NotesFocusService). */
  addItem(): void {
   const newItem: Item = {
      id: crypto.randomUUID(),
      title: '',
      type: NotesType.TODO,
      elements: []
    };
    this.tripFacade.createItem(this.tripId(), newItem);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `input[data-title-id="${newItem.id}"], textarea[data-title-id="${newItem.id}"]`
      );
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // `preventScroll` : sinon le scroll natif déclenché par `focus()` (souvent
      // instantané) écrase/interrompt le `scrollIntoView` smooth lancé juste
      // au-dessus, donnant l'impression que le scroll animé ne se produit pas.
      el?.focus({ preventScroll: true });
    });
  }

  addPoint(item: Item): void {
    const elements = [...item.elements, this.newPoint()];
    this.updateElements(item, elements);
    this.focusRow(item.id, elements.length - 1, 0);
  }

  removePoint(item: Item, index: number): void {
    this.updateElements(item, item.elements.filter((_, i) => i !== index));
  }

  toggleType(item: Item): void {
    const type = item.type === NotesType.TODO ? NotesType.INFO : NotesType.TODO;
    this.tripFacade.updateItem(this.tripId(), item.id, { type });
  }

  updateTitle(item: Item, title: string): void {
    this.tripFacade.updateItem(this.tripId(), item.id, { title });
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

  onBlurPoint(pointId: string) {
    setTimeout(() => {
      // On ne remet à null QUE si le point actif est toujours celui qui a déclenché le blur
      if (this.activePointId() === pointId) {
        this.activePointId.set(null);
      }
    });
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
    if (item.type !== NotesType.TODO) {
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

  focusRow(itemId: string, index: number, cursor: number): void {
    const selector = `textarea[data-item-id="${itemId}"][data-index="${index}"]`;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(selector);
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  private newPoint(text = '', checked = false): Point {
    return { id: crypto.randomUUID(), text, checked };
  }

  private updateElements(item: Item, elements: Point[]): void {
    this.tripFacade.updateItem(this.tripId(), item.id, { elements });
  }
}