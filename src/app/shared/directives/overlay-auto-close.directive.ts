/* eslint-disable @angular-eslint/directive-selector */
import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePicker } from 'primeng/datepicker';
import { AutoCloseOverlay, OverlayAutoCloseService } from '@core/services/overlay-auto-close.service';

/**
 * S'attache automatiquement à tout `p-datepicker` (le sélecteur matche la
 * balise elle-même, il suffit d'importer cette directive dans le composant
 * standalone concerné, aucune modification de template requise) et
 * l'enregistre auprès de `OverlayAutoCloseService` pour qu'il soit fermé :
 * - au clic/tap en dehors de son hôte et de son panneau, y compris quand ce
 *   clic ouvre un AUTRE p-datepicker (voir le service pour le détail du
 *   problème que ça corrige) ;
 * - explicitement via `closeAll()`, utilisé par le swiper au début d'un swipe.
 *
 * Couvrait aussi `p-select` avant la Phase 7d de la sortie de PrimeNG (voir
 * PRIMENG_MIGRATION.md) — `app-select` (Phase 7d) gère son ouverture/
 * fermeture nativement via `@angular/cdk/overlay` (backdrop click, Échap),
 * donc n'a plus besoin de cette coordination. Ne reste que `p-datepicker`,
 * jusqu'à sa propre migration (Phase 7f).
 */
@Directive({
  selector: 'p-datepicker',
  standalone: true,
})
export class OverlayAutoCloseDirective implements AutoCloseOverlay, OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly registry = inject(OverlayAutoCloseService);
  private readonly datepicker = inject(DatePicker, { self: true });

  readonly panelSelector = '.p-datepicker-panel';

  ngOnInit(): void {
    this.registry.register(this);
  }

  ngOnDestroy(): void {
    this.registry.unregister(this);
  }

  isOpen(): boolean {
    return !!this.datepicker.overlayVisible;
  }

  hostElement(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  close(): void {
    this.datepicker.hideOverlay();
  }
}
