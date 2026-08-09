import { Directive, DestroyRef, ElementRef, afterNextRender, computed, inject, input } from '@angular/core';
import { ViewportService } from '@app/core/services/viewport.service';
import { SelectableItemRef, SelectionModeService, selectableItemKey } from '@app/shared/services/selection-mode.service';

/**
 * Pose le mode sélection multiple sur la racine d'une carte (activité,
 * réservation, note, trip) : `.nt-selected` (voir styles/selection-mode.scss)
 * matérialise le liseré rouge dès que l'entité est dans la sélection.
 *
 * - Mobile (`ViewportService.isMobile()`) : un `appLongPress` posé à côté sur
 *   le même élément (voir template) déclenche `onLongPress()`, qui sélectionne
 *   et bascule en mode édition ; ensuite un simple tap sur la carte
 *   (dé)sélectionne, via l'interception en phase de capture ci-dessous — le
 *   comportement normal de la carte (dépli du panel, navigation) ne se
 *   déclenche donc plus tant qu'on est en mode édition.
 * - PC : seule la checkbox toujours visible (`onCheckboxClick()`, voir
 *   template) déclenche la sélection/le mode édition ; le reste de la carte
 *   garde son clic normal.
 */
@Directive({
  selector: '[appSelectable]',
  standalone: true,
  exportAs: 'appSelectable',
  host: {
    '[class.nt-selectable]': 'true',
    '[class.nt-selected]': 'isSelected()',
    // Mode sélection actif (≥1 carte sélectionnée sur cette liste), pas
    // seulement CETTE carte — voir selection-mode.scss, révèle la checkbox
    // mobile (masquée par défaut, sinon toujours visible = plus de place pour
    // le contenu de la carte sur mobile en usage normal, ROADMAP.md "UI").
    '[class.nt-selection-mode]': 'selectionService.active()',
  },
})
export class SelectableDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly selectionService = inject(SelectionModeService);
  private readonly viewport = inject(ViewportService);

  readonly appSelectable = input.required<SelectableItemRef>();
  /** ex. accueil-trip : seul le propriétaire du trip peut sélectionner/supprimer. */
  readonly selectableDisabled = input(false);

  readonly isSelected = computed(() =>
    this.selectionService.isSelectedKey(selectableItemKey(this.appSelectable()))
  );

  constructor() {
    afterNextRender(() => {
      const el = this.elementRef.nativeElement;
      // Capture (pas bubble) : doit s'exécuter AVANT les handlers de clic internes
      // de la carte (dépli de panel, navigation) — même idiome que
      // ActivityCardComponent.updateDragState.
      el.addEventListener('click', this.onCaptureClick, { capture: true });
      this.destroyRef.onDestroy(() => el.removeEventListener('click', this.onCaptureClick, true));
    });
  }

  /** Appelé depuis le template par `(longPress)` (voir LongPressDirective posée à côté). */
  onLongPress(): void {
    if (this.selectableDisabled() || !this.viewport.isMobile()) return;
    this.selectionService.toggle(this.appSelectable());
  }

  /** Checkbox PC toujours visible (voir template). */
  onCheckboxClick(event: Event): void {
    event.stopPropagation();
    if (this.selectableDisabled()) return;
    this.selectionService.toggle(this.appSelectable());
  }

  private readonly onCaptureClick = (event: MouseEvent): void => {
    if (this.selectableDisabled() || !this.selectionService.active() || !this.viewport.isMobile()) return;
    event.stopPropagation();
    event.preventDefault();
    this.selectionService.toggle(this.appSelectable());
  };
}
