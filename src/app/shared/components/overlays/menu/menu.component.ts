import { ChangeDetectionStrategy, Component, OnDestroy, TemplateRef, ViewContainerRef, inject, input, signal, viewChild } from '@angular/core';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ViewportService } from '@core/services/ui/viewport.service';

export interface AppMenuItem {
  label?: string;
  icon?: string;
  command?: () => void;
  /** Groupe (en-tête `label` + sous-items) — voir `runCommand`/le template pour le rendu à plat sinon. */
  items?: AppMenuItem[];
}

/** Desktop uniquement — sous le bouton, aligné sur son bord droit ; bascule au-dessus si la place manque en bas (`withPush`). */
const DESKTOP_POSITIONS: ConnectedPosition[] = [
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
 *
 * Desktop : popup ancré sous/à côté du déclencheur, comme `SelectComponent`.
 * Mobile (`ViewportService.isMobile()`) : tiroir plein écran ancré en bas
 * (même mécanique que `SelectComponent`, voir ROADMAP.md "menu Ajouter d'un
 * jour") — `title()` optionnel affiché en tête, choix de stratégie fait à
 * l'OUVERTURE comme les autres composants de ce type.
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  protected readonly viewport = inject(ViewportService);

  readonly items = input<AppMenuItem[]>([]);
  /** Titre affiché en tête du tiroir mobile — pas de rôle sur desktop (popup ancré, pas de header). */
  readonly title = input('');

  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef?: OverlayRef;
  /** Public (pas `protected`) : lu depuis le template hôte via `#menu` (ex. rotation de l'icône engrenage, `TripsComponent`) — pas seulement en interne. */
  readonly isOpen = signal(false);

  toggle(event: Event): void {
    this.toggleAt(event.currentTarget as HTMLElement);
  }

  /** Ouverture programmatique avec un élément d'ancrage explicite, quand le déclencheur réel ne vit pas dans LE TEMPLATE de ce composant (ex. bouton "+" flottant unique, voir `TripDetailComponent`/`DayPanelComponent`). Sans effet sur le tiroir mobile (pas d'ancrage), utile seulement pour le popup desktop. */
  toggleAt(trigger: HTMLElement): void {
    if (this.overlayRef) {
      this.close();
      return;
    }
    this.open(trigger);
  }

  private open(trigger: HTMLElement): void {
    const isMobile = this.viewport.isMobile();

    const positionStrategy = isMobile
      ? this.overlay.position().global().centerHorizontally().bottom('0')
      : this.overlay.position().flexibleConnectedTo(trigger).withPositions(DESKTOP_POSITIONS).withPush(true);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: isMobile ? 'app-menu-backdrop--mobile' : 'cdk-overlay-transparent-backdrop',
      width: isMobile ? '100%' : undefined,
      panelClass: isMobile ? 'app-menu-overlay--mobile' : 'app-menu-overlay--desktop',
    });
    this.overlayRef = overlayRef;

    overlayRef.backdropClick().subscribe(() => this.close());
    overlayRef.keydownEvents().subscribe((e) => {
      if (e.key === 'Escape') this.close();
    });

    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);
  }

  /** Public (pas seulement interne) : des appelants peuvent avoir besoin de fermer le menu depuis une action déclenchée ailleurs (ex. un déclencheur externe via `toggleAt`). */
  close(): void {
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
    this.isOpen.set(false);
  }

  protected runCommand(item: AppMenuItem): void {
    item.command?.();
    this.close();
  }

  /**
   * L'overlay CDK est attaché à `OverlayContainer` (racine du document), pas
   * à l'arbre de vue de ce composant : sans ce nettoyage, une instance de
   * `app-menu` montée dans un composant qui peut être détruit alors que le
   * menu est ouvert (ex. header de trip, détruit par une navigation router
   * pendant que son propre menu local est affiché) laisserait l'overlay
   * orphelin à l'écran au lieu de se fermer.
   */
  ngOnDestroy(): void {
    this.close();
  }
}
