import { Component, ElementRef, TemplateRef, ViewContainerRef, contentChild, forwardRef, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Sous le champ, aligné sur son bord gauche ; bascule au-dessus si la place manque en bas. */
const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Remplacement maison de `p-autoComplete` (Phase 7e de la sortie de
 * PrimeNG, voir PRIMENG_MIGRATION.md). Sur `@angular/cdk/overlay`, comme
 * `SelectComponent`/`MenuComponent` (mêmes Phases 7d/7b) — même raison
 * (top layer, voir la doc de `TooltipDirective`).
 *
 * Différence de fond avec `Select` : la valeur est un texte LIBRE (CVA sur
 * une chaîne, pas sur une valeur choisie dans une liste fermée) — le panneau
 * ne s'ouvre qu'à la frappe (pas de bouton déclencheur), et se ferme au flou
 * du champ plutôt que par backdrop/Échap CDK (`hasBackdrop: false` : un
 * champ de recherche texte n'a pas besoin de bloquer le reste de la page).
 * `(mousedown)` empêché sur chaque option : sans ça, cliquer une suggestion
 * fait D'ABORD perdre le focus au champ (donc fermer le panneau via
 * `onBlurInput`) AVANT que le `click` n'ait la moindre chance de se
 * déclencher — piège classique de tout autocomplete à base d'input+liste.
 *
 * Contenu des options personnalisable via `<ng-template #item let-x>` projeté
 * (repris tel quel de l'ancien usage `p-autoComplete` : mêmes deux templates
 * dans activity-header/new-trip, aucun changement de syntaxe requis côté
 * appelant) — `contentChild('item')` retrouve cette référence de template
 * locale exactement comme le faisait PrimeNG en interne.
 */
@Component({
  selector: 'app-autocomplete',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './autocomplete.component.html',
  styleUrl: './autocomplete.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutoCompleteComponent),
      multi: true,
    },
  ],
})
export class AutoCompleteComponent<T = unknown> implements ControlValueAccessor {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly suggestions = input<T[]>([]);
  readonly displayWith = input<(item: T) => string>((item) => String(item));
  readonly placeholder = input('');
  readonly emptyMessage = input('Aucun résultat trouvé');
  /** Classes additionnelles posées sur le `<input>` interne (même pattern que `InputNumberComponent.inputClass`). */
  readonly inputClass = input('');

  /** Émis à chaque frappe (texte brut) — le débounce/la recherche restent à la charge de l'appelant (voir GooglePlaceService.search$, déjà débouncé). Nommé `searched` (pas `search`, événement DOM natif) — voir la note sur `blurred`. */
  readonly searched = output<string>();
  /** Émis avec l'objet complet suggéré (pas juste son libellé) quand une option est choisie. */
  readonly optionSelected = output<T>();
  /**
   * Émis quand le champ perd le focus. Nommé `blurred` (pas `blur`) : un nom
   * d'output correspondant à un événement DOM natif prête à confusion sur un
   * composant (l'hôte lui-même n'est pas focusable, seul le `<input>`
   * interne l'est) — mieux vaut un nom sans ambiguïté.
   */
  readonly blurred = output<void>();

  protected readonly itemTemplate = contentChild<TemplateRef<{ $implicit: T }>>('item');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  protected readonly value = signal('');
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);

  private overlayRef?: OverlayRef;
  private onChange?: (value: string) => void;
  private onTouched?: () => void;

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (isDisabled) this.close();
  }

  protected onInput(text: string): void {
    this.value.set(text);
    this.onChange?.(text);
    this.searched.emit(text);
    if (!this.overlayRef) this.open();
  }

  protected onBlurInput(): void {
    this.close();
    this.onTouched?.();
    this.blurred.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  protected selectOption(option: T): void {
    const text = this.displayWith()(option);
    this.value.set(text);
    this.onChange?.(text);
    this.optionSelected.emit(option);
    this.close();
  }

  private open(): void {
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef.nativeElement)
      .withPositions(POSITIONS)
      .withFlexibleDimensions(false)
      .withPush(true);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
      panelClass: 'app-autocomplete-overlay',
      width: this.elementRef.nativeElement.getBoundingClientRect().width,
    });
    this.overlayRef = overlayRef;

    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);
  }

  private close(): void {
    if (!this.overlayRef) return;
    this.overlayRef.dispose();
    this.overlayRef = undefined;
    this.isOpen.set(false);
  }
}
