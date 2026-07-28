import { Component, TemplateRef, ViewContainerRef, inject, input, signal, viewChild } from '@angular/core';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

export interface AppMenuItem {
  label?: string;
  icon?: string;
  command?: () => void;
  /** Groupe (en-tête `label` + sous-items) — voir `runCommand`/le template pour le rendu à plat sinon. */
  items?: AppMenuItem[];
}

/** Sous le bouton, aligné sur son bord droit ; bascule au-dessus si la place manque en bas (`withPush`). */
const POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Remplacement maison de `p-menu` en mode `[popup]="true"` (Phase 7b de la
 * sortie de PrimeNG, voir PRIMENG_MIGRATION.md) : seul mode utilisé dans le
 * projet (roue crantée de `TripsComponent`), donc pas de mode inline à
 * porter. Sur `@angular/cdk/overlay` directement (pas `cdk/dialog`, qui
 * impose une sémantique modale/focus-trap inadaptée à un simple popup
 * ancré) : premier consommateur de cdk/overlay dans le projet, dont
 * `overlay-prebuilt.css` est déjà chargé depuis la Phase 2 (Dialog).
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);

  readonly items = input<AppMenuItem[]>([]);

  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef?: OverlayRef;
  protected readonly isOpen = signal(false);

  toggle(event: Event): void {
    if (this.overlayRef) {
      this.close();
      return;
    }
    this.open(event.currentTarget as HTMLElement);
  }

  private open(trigger: HTMLElement): void {
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(trigger)
      .withPositions(POSITIONS)
      .withPush(true);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
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
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
    this.isOpen.set(false);
  }

  protected runCommand(item: AppMenuItem): void {
    item.command?.();
    this.close();
  }
}
