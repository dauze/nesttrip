import { Component, ElementRef, TemplateRef, ViewContainerRef, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
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
  protected readonly viewport = inject(ViewportService);

  readonly options = input<SelectOption<T>[]>([]);
  readonly placeholder = input('Sélectionner');

  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  protected readonly value = signal<T | null>(null);
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);

  protected readonly selectedLabel = computed(() => {
    const current = this.value();
    return this.options().find((o) => o.value === current)?.label ?? '';
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
    this.open();
  }

  private open(): void {
    const isMobile = this.viewport.isMobile();

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
  }

  private close(): void {
    if (!this.overlayRef) return;
    this.overlayRef.dispose();
    this.overlayRef = undefined;
    this.isOpen.set(false);
    this.onTouched?.();
  }

  protected selectOption(option: SelectOption<T>): void {
    this.value.set(option.value);
    this.onChange?.(option.value);
    this.close();
  }
}
