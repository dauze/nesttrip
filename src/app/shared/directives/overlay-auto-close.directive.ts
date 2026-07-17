import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { AutoCloseOverlay, OverlayAutoCloseService } from '@core/services/overlay-auto-close.service';

/**
 * S'attache automatiquement à tout `p-select` / `p-datepicker` (le sélecteur
 * matche les balises elles-mêmes, il suffit d'importer cette directive dans
 * le composant standalone concerné, aucune modification de template requise)
 * et l'enregistre auprès de `OverlayAutoCloseService` pour qu'il soit fermé :
 * - au clic/tap en dehors de son hôte et de son panneau, y compris quand ce
 *   clic ouvre un AUTRE p-select/p-datepicker (voir le service pour le détail
 *   du problème que ça corrige) ;
 * - explicitement via `closeAll()`, utilisé par le swiper au début d'un swipe.
 */
@Directive({
  selector: 'p-select, p-datePicker, p-datepicker, p-date-picker',
  standalone: true,
})
export class OverlayAutoCloseDirective implements AutoCloseOverlay, OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly registry = inject(OverlayAutoCloseService);
  private readonly select = inject(Select, { self: true, optional: true });
  private readonly datepicker = inject(DatePicker, { self: true, optional: true });

  readonly panelSelector = this.select ? '.p-select-overlay' : '.p-datepicker-panel';

  ngOnInit(): void {
    this.registry.register(this);
  }

  ngOnDestroy(): void {
    this.registry.unregister(this);
  }

  isOpen(): boolean {
    return !!(this.select?.overlayVisible || this.datepicker?.overlayVisible);
  }

  hostElement(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  close(): void {
    this.select?.hide();
    this.datepicker?.hideOverlay();
  }
}