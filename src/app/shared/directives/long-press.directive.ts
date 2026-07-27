import { Directive, DestroyRef, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

const DEFAULT_DELAY_MS = 500;
/** Au-delà de ce déplacement (px), on considère que le doigt scrolle/drague : plus un "appui maintenu". */
const MOVE_THRESHOLD_PX = 10;

/**
 * Émet `(longPress)` après un appui maintenu sans déplacement significatif.
 * Volontairement générique (aucune connaissance du mode sélection, voir
 * SelectableDirective qui la consomme) : n'appelle jamais `preventDefault()`
 * sur `pointerdown`/`pointermove`, pour ne jamais gêner le scroll tactile
 * natif (contrairement à `ActivityCardComponent.updateDragState`, qui a une
 * bonne raison de le faire sur sa propre poignée de drag).
 */
@Directive({
  selector: '[appLongPress]',
  standalone: true,
})
export class LongPressDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly longPressDelay = input(DEFAULT_DELAY_MS);
  readonly longPress = output<void>();

  private timer?: ReturnType<typeof setTimeout>;
  private startX = 0;
  private startY = 0;

  constructor() {
    afterNextRender(() => {
      const el = this.elementRef.nativeElement;
      el.addEventListener('pointerdown', this.onPointerDown);
      el.addEventListener('pointermove', this.onPointerMove);
      el.addEventListener('pointerup', this.clear);
      el.addEventListener('pointercancel', this.clear);
      el.addEventListener('pointerleave', this.clear);

      this.destroyRef.onDestroy(() => {
        el.removeEventListener('pointerdown', this.onPointerDown);
        el.removeEventListener('pointermove', this.onPointerMove);
        el.removeEventListener('pointerup', this.clear);
        el.removeEventListener('pointercancel', this.clear);
        el.removeEventListener('pointerleave', this.clear);
        this.clear();
      });
    });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    // Souris : pas de long-press (sur PC, l'entrée en mode sélection passe
    // uniquement par la checkbox, voir SelectableDirective).
    if (event.pointerType === 'mouse') return;

    this.startX = event.clientX;
    this.startY = event.clientY;
    this.clear();
    this.timer = setTimeout(() => this.longPress.emit(), this.longPressDelay());
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const movedX = Math.abs(event.clientX - this.startX);
    const movedY = Math.abs(event.clientY - this.startY);
    if (movedX > MOVE_THRESHOLD_PX || movedY > MOVE_THRESHOLD_PX) this.clear();
  };

  private readonly clear = (): void => {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  };
}
