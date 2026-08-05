import { Directive, ElementRef, OnDestroy, afterNextRender, effect, inject, input, output } from '@angular/core';
import { getScrollContainer } from '@app/shared/utils/scroll-container';

/** Marge sous laquelle on considère être "en bas" du scroll (ne peut plus descendre). */
const BOTTOM_MARGIN_PX = 32;

/**
 * Signale si le scroll du `swiper-slide` ancêtre (voir `getScrollContainer`)
 * est proche du bas — utilisé par les écrans à cartes (jour, pool
 * d'activités, logistique) pour piloter l'évitement de bord du bouton "+"
 * flottant (voir `TripCreationTargetService.avoidEdge`, ROADMAP.md "UX /
 * Interactions"). Un seul écouteur de scroll par écran, posé sur le
 * conteneur ancêtre plutôt que sur l'élément porteur lui-même.
 */
@Directive({
  selector: '[appFabBottomProximity]',
  standalone: true,
})
export class FabBottomProximityDirective implements OnDestroy {
  private readonly elRef = inject(ElementRef<HTMLElement>);

  /** Désactive la détection (ex. jour préchargé mais pas actif) — remonte toujours `false` dans ce cas. */
  readonly fabBottomProximityActive = input(true, { alias: 'appFabBottomProximity' });

  readonly nearBottomChange = output<boolean>();

  private container: HTMLElement | null = null;
  private lastValue = false;

  constructor() {
    afterNextRender(() => {
      this.container = getScrollContainer(this.elRef.nativeElement);
      this.container?.addEventListener('scroll', this.onScroll, { passive: true });
      this.check();
    });

    // Recalcule dès que l'écran redevient actif (ex. jour préchargé qui
    // devient le jour affiché sans nouvel événement de scroll entre-temps).
    effect(() => {
      this.fabBottomProximityActive();
      this.check();
    });
  }

  ngOnDestroy(): void {
    this.container?.removeEventListener('scroll', this.onScroll);
    this.emit(false);
  }

  private readonly onScroll = (): void => this.check();

  private check(): void {
    if (!this.fabBottomProximityActive() || !this.container) {
      this.emit(false);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = this.container;
    const nearBottom = scrollHeight - clientHeight > 0 && scrollTop + clientHeight >= scrollHeight - BOTTOM_MARGIN_PX;
    this.emit(nearBottom);
  }

  private emit(value: boolean): void {
    if (value === this.lastValue) return;
    this.lastValue = value;
    this.nearBottomChange.emit(value);
  }
}
