import { ChangeDetectionStrategy, Component, ElementRef, TemplateRef, ViewContainerRef, contentChild, forwardRef, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MAX_TITLE_LENGTH } from '@app/shared/utils/input-limits';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  /** Longueur max du texte libre saisi (ROADMAP.md "Qualité / process") — tous les usages actuels sont des champs "titre"/lieu, jamais un texte long. */
  readonly maxLength = input(MAX_TITLE_LENGTH);
  /**
   * Opt-in (défaut `false`) : rend un `<textarea>` auto-ajusté à la place de
   * l'`<input>` mono-ligne, pour qu'un libellé long wrappe sur plusieurs
   * lignes au lieu d'être tronqué. Activé uniquement sur le titre d'activité
   * (voir activity-header) — les autres usages (ville, logistique, brouillon)
   * restent mono-ligne. Le texte reste une seule ligne logique : `Entrée`
   * valide (blur) plutôt que d'insérer un saut de ligne.
   */
  readonly multiline = input(false);

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
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('input');

  protected readonly value = signal('');
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);

  private overlayRef?: OverlayRef;
  private onChange?: (value: string) => void;
  private onTouched?: () => void;

  writeValue(value: string): void {
    this.value.set(value ?? '');
    // La valeur peut être posée par le formulaire après le rendu (ex. titre
    // existant chargé) : réajuster la hauteur du textarea au contenu.
    if (this.multiline()) this.scheduleAutosize();
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
    if (this.multiline()) this.autosize();
    if (!this.overlayRef) this.open();
  }

  protected onBlurInput(): void {
    this.close();
    this.onTouched?.();
    this.blurred.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
    // En mode multi-ligne (titre), un titre reste une seule ligne logique :
    // `Entrée` ne doit pas insérer de saut de ligne mais valider la saisie.
    // (Shift+Entrée laissé libre serait incohérent → on bloque aussi.)
    if (this.multiline() && event.key === 'Enter') {
      event.preventDefault();
      this.inputRef()?.nativeElement.blur();
    }
  }

  protected selectOption(option: T): void {
    const text = this.displayWith()(option);
    this.value.set(text);
    this.onChange?.(text);
    this.optionSelected.emit(option);
    if (this.multiline()) this.scheduleAutosize();
    this.close();
  }

  /**
   * Ajuste la hauteur du `<textarea>` à son contenu (autosize) : on remet la
   * hauteur à `auto` pour que `scrollHeight` reflète le contenu réel, puis on
   * la fixe à `scrollHeight`. No-op si le champ n'est pas (encore) un textarea.
   */
  private autosize(): void {
    const el = this.inputRef()?.nativeElement;
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  /** Autosize au prochain tick, quand la valeur a été posée hors frappe (writeValue/selectOption) et que le DOM est à jour. */
  private scheduleAutosize(): void {
    queueMicrotask(() => this.autosize());
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

  /** Focus programmatique (ex. brouillon de création desktop, voir NewActivityDraftComponent). */
  focus(): void {
    this.inputRef()?.nativeElement.focus();
  }
}
