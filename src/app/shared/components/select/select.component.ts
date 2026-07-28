import { Component, ElementRef, Injector, TemplateRef, ViewContainerRef, afterNextRender, computed, forwardRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ViewportService } from '@core/services/viewport.service';

export interface SelectOption<T> {
  label: string;
  value: T;
}

/** Sous le champ, aligné sur son bord gauche ; bascule au-dessus si la place manque en bas. */
const DESKTOP_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Remplacement maison de `p-select` (Phase 7d de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Sur `@angular/cdk/overlay`, comme `MenuComponent`
 * (Phase 7b) : même primitive, même raison (rejoint le "top layer" natif du
 * navigateur via `popover`, actif par défaut sur les overlays CDK — voir la
 * doc de `TooltipDirective` sur pourquoi un `<div>` `position:fixed` fait
 * main ne peut structurellement pas rivaliser autrement).
 *
 * Desktop : liste ancrée sous le champ (`flexibleConnectedTo`), comme
 * l'ancien `p-select`. Mobile (`ViewportService.isMobile()`, même breakpoint
 * 768px que l'ancien `[touchUI]`) : tiroir plein écran ancré en bas — choix
 * de stratégie de positionnement fait à l'OUVERTURE (comme l'ancien binding
 * `[touchUI]`, lui aussi évalué à un instant donné, pas une media query CSS
 * live) via un `positionStrategy`/`panelClass` différents.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent<T = unknown> implements ControlValueAccessor {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  protected readonly viewport = inject(ViewportService);

  readonly options = input<SelectOption<T>[]>([]);
  readonly placeholder = input('Sélectionner');

  /** Émis à la fermeture du panneau, `selected` distingue un choix (`selectOption`) d'un simple backdrop/Échap — utilisé par le chaînage de saisie guidée (voir ActivityFormComponent.startGuidedEntry). */
  readonly closed = output<{ selected: boolean }>();

  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly mobileSearchInput = viewChild<ElementRef<HTMLInputElement>>('mobileSearchInput');

  protected readonly value = signal<T | null>(null);
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);

  protected readonly selectedLabel = computed(() => {
    const current = this.value();
    return this.options().find((o) => o.value === current)?.label ?? '';
  });

  /**
   * Tiroir mobile uniquement (voir le template) : préremplie avec le libellé
   * de la sélection courante à l'ouverture, pour qu'on la voie tout de suite
   * plutôt que de devoir chercher parmi les options — voir ROADMAP.md.
   * Filtre aussi la liste au fil de la frappe.
   */
  protected readonly mobileSearchTerm = signal('');

  protected readonly filteredOptions = computed(() => {
    const term = this.mobileSearchTerm().trim().toLowerCase();
    if (!term) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(term));
  });

  private overlayRef?: OverlayRef;
  private onChange?: (value: T) => void;
  private onTouched?: () => void;

  writeValue(value: T): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (isDisabled) this.close();
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (this.overlayRef) {
      this.close();
      return;
    }
    this.openPanel();
  }

  /** Ouverture programmatique du panneau (ex. chaînage de saisie guidée) — même logique que le clic sur le champ. */
  openPanel(): void {
    if (this.isDisabled() || this.overlayRef) return;
    this.open();
  }

  private open(): void {
    const isMobile = this.viewport.isMobile();
    this.mobileSearchTerm.set(isMobile ? this.selectedLabel() : '');

    const positionStrategy = isMobile
      ? this.overlay.position().global().centerHorizontally().bottom('0')
      : this.overlay
          .position()
          .flexibleConnectedTo(this.elementRef.nativeElement)
          .withPositions(DESKTOP_POSITIONS)
          .withFlexibleDimensions(false)
          .withPush(true);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: isMobile ? 'app-select-backdrop--mobile' : 'cdk-overlay-transparent-backdrop',
      width: isMobile ? '100%' : undefined,
      panelClass: isMobile ? 'app-select-overlay--mobile' : 'app-select-overlay--desktop',
    });
    this.overlayRef = overlayRef;

    overlayRef.backdropClick().subscribe(() => this.close());
    overlayRef.keydownEvents().subscribe((e) => {
      if (e.key === 'Escape') this.close();
    });

    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);

    if (isMobile) {
      afterNextRender(() => this.mobileSearchInput()?.nativeElement.select(), { injector: this.injector });
    }
  }

  private close(selected = false): void {
    if (!this.overlayRef) return;
    this.overlayRef.dispose();
    this.overlayRef = undefined;
    this.isOpen.set(false);
    this.onTouched?.();
    this.closed.emit({ selected });
  }

  protected selectOption(option: SelectOption<T>): void {
    this.value.set(option.value);
    this.onChange?.(option.value);
    this.close(true);
  }
}
